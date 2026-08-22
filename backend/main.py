import os
import sys
import time
import uuid
import socket
import traceback
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
import database as db
import spotify_client as sp_client
import applescript_controller as apple_ctrl

load_dotenv()

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield

app = FastAPI(title="Kiki's Spotify Mixer", lifespan=lifespan)

# --- Pydantic Request Models ---

class CredentialsRequest(BaseModel):
    client_id: str
    client_secret: str
    redirect_uri: Optional[str] = "http://127.0.0.1:8888/callback"

class TagCreateRequest(BaseModel):
    name: str
    color: Optional[str] = "#1DB954"

class BatchTagRequest(BaseModel):
    track_ids: List[str]
    tag_names: List[str]

class TagRenameRequest(BaseModel):
    old_name: str
    new_name: str

class TagReorderRequest(BaseModel):
    tag_names: List[str]

class ReorderRequest(BaseModel):
    playlist_id: Optional[str] = "default"
    track_ids: List[str]

class CreatePlaylistRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    track_ids: List[str]

class PlaylistRenameRequest(BaseModel):
    new_name: str

class AddTrackToPlaylistRequest(BaseModel):
    track_id: str

class PlayRequest(BaseModel):
    uris: List[str]
    true_shuffle: Optional[bool] = False
    avoid_consecutive_artists: Optional[bool] = False
    device_id: Optional[str] = None

class ControlRequest(BaseModel):
    action: str
    device_id: Optional[str] = None

class VolumeRequest(BaseModel):
    volume_percent: int
    device_id: Optional[str] = None

class SeekRequest(BaseModel):
    position_ms: int
    device_id: Optional[str] = None

class ExportTagRequest(BaseModel):
    tag_name: str

# --- API Endpoints ---

@app.get("/api/status")
def get_status():
    has_creds = bool(os.getenv("SPOTIFY_CLIENT_ID") and os.getenv("SPOTIFY_CLIENT_ID") != "your_client_id_here")
    auth = sp_client.is_authenticated() if has_creds else False
    is_mac = sys.platform == "darwin"
    mac_app_running = apple_ctrl.is_spotify_running() if is_mac else False
    local_ip = get_local_ip()
    port = os.getenv("PORT", "8888")
    
    return {
        "authenticated": auth,
        "has_credentials": has_creds,
        "is_mac": is_mac,
        "mac_spotify_running": mac_app_running,
        "local_ip": local_ip,
        "port": port,
        "access_url": f"http://{local_ip}:{port}"
    }

@app.post("/api/credentials")
def save_credentials(creds: CredentialsRequest):
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    
    os.environ["SPOTIFY_CLIENT_ID"] = creds.client_id.strip()
    os.environ["SPOTIFY_CLIENT_SECRET"] = creds.client_secret.strip()
    os.environ["SPOTIFY_REDIRECT_URI"] = creds.redirect_uri.strip()
    
    with open(env_path, "w") as f:
        f.write(f"SPOTIFY_CLIENT_ID={creds.client_id.strip()}\n")
        f.write(f"SPOTIFY_CLIENT_SECRET={creds.client_secret.strip()}\n")
        f.write(f"SPOTIFY_REDIRECT_URI={creds.redirect_uri.strip()}\n")
        f.write(f"HOST=0.0.0.0\nPORT=8888\nDATABASE_PATH=spotify_tags.db\n")
        
    return {"success": True, "message": "Credentials saved"}

@app.get("/api/auth/login")
def auth_login():
    oauth = sp_client.get_spotify_oauth()
    if not oauth:
        raise HTTPException(status_code=400, detail="Spotify credentials not configured")
    auth_url = oauth.get_authorize_url()
    return {"auth_url": auth_url}

@app.get("/callback")
def auth_callback(code: Optional[str] = None, error: Optional[str] = None):
    if error:
        return HTMLResponse(f"<h3>Spotify Auth Error: {error}</h3><p><a href='/'>Return to App</a></p>")
    if not code:
        return RedirectResponse("/")
        
    oauth = sp_client.get_spotify_oauth()
    if oauth:
        oauth.get_access_token(code, as_dict=False)
        
    return RedirectResponse("/?auth=success")

# --- Search Catalog & Song Discovery ---

@app.get("/api/search")
def search_tracks(q: str = Query(..., min_length=1), type: str = "all"):
    # 1. Search Spotify Catalog with modifier
    catalog_results = sp_client.search_catalog(q, search_type=type, limit=25)
    if catalog_results:
        db.upsert_tracks(catalog_results)
    
    # 2. Also search local library
    local_results = db.get_tracks_query(search=q)
    
    # Combine (local tracks first with their tags, then catalog tracks)
    seen_ids = set()
    combined = []
    for t in local_results:
        seen_ids.add(t["id"])
        combined.append(t)
        
    for t in catalog_results:
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
            t["tags"] = []
            combined.append(t)
            
    # STRICT FILTERING ONLY
    raw_q = q.strip().lower()
    if type == "track":
        combined = [t for t in combined if raw_q in t["title"].lower()]
    elif type == "artist":
        combined = [t for t in combined if raw_q in t["artist"].lower()]
    elif type == "all":
        combined = [t for t in combined if (raw_q in t["title"].lower() or raw_q in t["artist"].lower() or raw_q in t.get("album", "").lower())]
            
    return {"results": combined, "count": len(combined)}

# --- Track & Library Sync ---

@app.post("/api/sync")
def sync_library(sync_playlists: bool = True):
    if not sp_client.is_authenticated():
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Spotify. Please click ⚙️ Settings and connect your Spotify account first."
        )
        
    try:
        liked_tracks = sp_client.fetch_all_liked_songs(limit=300)
        db.upsert_tracks(liked_tracks)
        
        liked_ids = [t["id"] for t in liked_tracks]
        db.upsert_playlists([{
            "id": "liked_songs",
            "name": "Liked Songs",
            "description": "Your saved Spotify tracks",
            "image_url": "https://misc.scdn.co/liked-songs/liked-songs-300.png",
            "total_tracks": len(liked_tracks),
            "is_custom": 1
        }])
        db.set_playlist_tracks("liked_songs", liked_ids)
        
        if sync_playlists:
            try:
                user_playlists = sp_client.fetch_all_playlists(limit=25)
                db.upsert_playlists(user_playlists)
                
                # Fetch tracks for all user playlists
                for p in user_playlists:
                    try:
                        p_tracks = sp_client.fetch_playlist_tracks(p["id"], limit=200)
                        if p_tracks:
                            db.upsert_tracks(p_tracks)
                            db.set_playlist_tracks(p["id"], [t["id"] for t in p_tracks])
                    except Exception as pe:
                        print(f"Error syncing playlist {p.get('id')}: {pe}")
            except Exception as ple:
                print(f"Error fetching playlists: {ple}")
                    
        return {"success": True, "liked_count": len(liked_tracks)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@app.get("/api/tracks")
def get_tracks(
    playlist_id: Optional[str] = None,
    tags: Optional[str] = None,
    filter_mode: str = "AND",
    search: Optional[str] = None,
    untagged_only: bool = False,
    sort_by: str = "order_index",
    sort_direction: str = "asc"
):
    # If playlist tracks not in DB, fetch on-demand from Spotify!
    if playlist_id and playlist_id != "liked_songs":
        existing = db.get_tracks_query(playlist_id=playlist_id)
        if not existing and sp_client.is_authenticated():
            p_tracks = sp_client.fetch_playlist_tracks(playlist_id, limit=200)
            if p_tracks:
                db.upsert_tracks(p_tracks)
                db.set_playlist_tracks(playlist_id, [t["id"] for t in p_tracks])

    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    tracks = db.get_tracks_query(
        playlist_id=playlist_id,
        tags=tag_list,
        filter_mode=filter_mode,
        search=search,
        untagged_only=untagged_only,
        sort_by=sort_by,
        sort_direction=sort_direction
    )
    return {"tracks": tracks, "count": len(tracks)}

@app.get("/api/playlists")
def get_playlists(force_refresh: bool = False):
    existing = db.get_playlists()
    if (not existing or force_refresh) and sp_client.is_authenticated():
        try:
            user_playlists = sp_client.fetch_all_playlists(limit=30)
            if user_playlists:
                db.upsert_playlists(user_playlists)
                existing = db.get_playlists()
        except Exception as e:
            print(f"Auto-import playlists error: {e}")
    return {"playlists": existing}

@app.post("/api/playlists/create")
def create_playlist(req: CreatePlaylistRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Playlist name is required")
        
    p_id = f"custom_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    
    # 1. Save locally in database immediately
    db.upsert_playlists([{
        "id": p_id,
        "name": req.name.strip(),
        "description": req.description or "",
        "image_url": "",
        "total_tracks": len(req.track_ids),
        "is_custom": 1
    }])
    db.set_playlist_tracks(p_id, req.track_ids)
    
    # 2. Try sync to Spotify
    spotify_playlist_id = None
    if sp_client.is_authenticated():
        try:
            tracks = db.get_tracks_query()
            track_map = {t["id"]: t for t in tracks}
            uris = [track_map[t_id]["uri"] if t_id in track_map else f"spotify:track:{t_id}" for t_id in req.track_ids]
            res = sp_client.create_user_playlist(req.name, req.description or "", uris)
            if res and isinstance(res, dict) and res.get("success"):
                spotify_playlist_id = res.get("playlist_id")
        except Exception as e:
            print(f"Spotify create playlist error: {e}")
            
    return {"success": True, "playlist_id": p_id, "spotify_id": spotify_playlist_id, "name": req.name}

@app.post("/api/playlists/{playlist_id}/add-track")
def add_track_to_playlist(playlist_id: str, req: AddTrackToPlaylistRequest):
    db.add_track_to_playlist(playlist_id, req.track_id)
    return {"success": True}

@app.post("/api/playlists/reorder")
def reorder_playlist(req: ReorderRequest):
    p_id = req.playlist_id or "liked_songs"
    db.reorder_playlist_tracks(p_id, req.track_ids)
    return {"success": True, "count": len(req.track_ids)}

@app.post("/api/playlists/{playlist_id}/rename")
def rename_playlist(playlist_id: str, req: PlaylistRenameRequest):
    if not req.new_name.strip():
        raise HTTPException(status_code=400, detail="Playlist name cannot be empty")
    db.rename_playlist(playlist_id, req.new_name.strip())
    if sp_client.is_authenticated() and not playlist_id.startswith("custom_") and playlist_id != "liked_songs":
        try:
            sp = sp_client.get_spotify_client()
            if sp:
                sp.playlist_change_details(playlist_id, name=req.new_name.strip())
        except Exception as e:
            print(f"Spotify playlist rename sync error: {e}")
    return {"success": True, "playlist_id": playlist_id, "new_name": req.new_name}

@app.delete("/api/playlists/{playlist_id}")
def delete_playlist(playlist_id: str):
    db.delete_playlist(playlist_id)
    return {"success": True}

# --- Tags Endpoints ---

@app.get("/api/tags")
def get_tags():
    return {"tags": db.get_all_tags()}

@app.post("/api/tags")
def create_tag(req: TagCreateRequest):
    tag = db.create_or_update_tag(req.name, req.color or "#1DB954")
    return {"success": True, "tag": tag}

@app.post("/api/tags/rename")
def rename_tag(req: TagRenameRequest):
    try:
        res = db.rename_tag(req.old_name, req.new_name)
        return {"success": True, **res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/tags/reorder")
def reorder_tags(req: TagReorderRequest):
    db.reorder_tags(req.tag_names)
    return {"success": True, "count": len(req.tag_names)}

@app.delete("/api/tags")
def delete_tag_query(name: str = Query(...)):
    db.delete_tag(name)
    return {"success": True}

@app.delete("/api/tags/{name:path}")
def delete_tag(name: str):
    db.delete_tag(name)
    return {"success": True}

@app.post("/api/tags/assign")
def assign_tags(req: BatchTagRequest):
    db.assign_tags_to_tracks(req.track_ids, req.tag_names)
    return {"success": True, "updated_tracks": len(req.track_ids)}

@app.post("/api/tags/remove")
def remove_tags(req: BatchTagRequest):
    db.remove_tags_from_tracks(req.track_ids, req.tag_names)
    return {"success": True, "updated_tracks": len(req.track_ids)}

@app.post("/api/playlists/export-tag")
def export_tag(req: ExportTagRequest):
    tracks = db.get_tracks_query(tags=[req.tag_name], filter_mode="AND")
    uris = [t["uri"] for t in tracks]
    if not uris:
        raise HTTPException(status_code=400, detail=f"No tracks found for tag #{req.tag_name}")
    res = sp_client.export_tag_to_playlist(req.tag_name, uris)
    return res

# --- Playback & True Random Controller ---

@app.post("/api/player/play")
def play_track_selection(req: PlayRequest):
    uris = req.uris
    if not uris:
        raise HTTPException(status_code=400, detail="No track URIs provided")
        
    if req.true_shuffle:
        artist_map = {}
        if req.avoid_consecutive_artists:
            all_tracks = db.get_tracks_query()
            artist_map = {t["uri"]: t["artist"] for t in all_tracks}
            
        shuffled = sp_client.fisher_yates_true_shuffle(
            uris,
            avoid_consecutive_artists=req.avoid_consecutive_artists,
            artist_lookup=artist_map
        )
        uris = shuffled

    # 1. Try Spotify Web API first
    if sp_client.is_authenticated():
        res = sp_client.play_tracks(uris, device_id=req.device_id)
        if res.get("success"):
            return {"success": True, "engine": "spotify_web_api", "playing_uris": uris}
            
    # 2. Fallback to macOS AppleScript
    if sys.platform == "darwin" and apple_ctrl.is_spotify_running():
        first_uri = uris[0]
        if apple_ctrl.play_track(first_uri):
            return {"success": True, "engine": "applescript", "playing_uris": uris}

    raise HTTPException(status_code=500, detail="Failed to start playback. Make sure Spotify is open on Mac or Android.")

@app.post("/api/player/control")
def player_control(req: ControlRequest):
    action = req.action.lower()
    
    # 1. On Mac, local AppleScript is instant (0.01s), foolproof, and avoids 429 rate limits completely
    if sys.platform == "darwin" and apple_ctrl.is_spotify_running():
        if action in ["play", "resume"]:
            apple_ctrl.resume()
        elif action == "pause":
            apple_ctrl.pause()
        elif action == "playpause":
            apple_ctrl.playpause()
        elif action == "next":
            apple_ctrl.next_track()
        elif action == "previous":
            apple_ctrl.previous_track()
        return {"success": True, "engine": "applescript"}
        
    # 2. Web API for remote clients / Android
    if sp_client.is_authenticated():
        try:
            if action == "pause":
                if sp_client.pause(device_id=req.device_id):
                    return {"success": True}
            elif action in ["play", "resume"]:
                if sp_client.resume(device_id=req.device_id):
                    return {"success": True}
            elif action == "playpause":
                state = sp_client.get_current_playback_state()
                if state and state.get("is_playing"):
                    sp_client.pause(device_id=req.device_id)
                else:
                    sp_client.resume(device_id=req.device_id)
                return {"success": True}
            elif action == "next":
                if sp_client.next_track(device_id=req.device_id):
                    return {"success": True}
            elif action == "previous":
                if sp_client.previous_track(device_id=req.device_id):
                    return {"success": True}
        except Exception as e:
            print(f"Web API control error: {e}")
            
    raise HTTPException(status_code=400, detail="Unable to execute playback action")

@app.post("/api/player/seek")
def player_seek(req: SeekRequest):
    if sys.platform == "darwin" and apple_ctrl.is_spotify_running():
        apple_ctrl.set_position(req.position_ms / 1000.0)
        return {"success": True, "engine": "applescript"}
    if sp_client.is_authenticated():
        sp_client.seek(req.position_ms, device_id=req.device_id)
        return {"success": True}
    return {"success": False}

@app.post("/api/player/volume")
def player_volume(req: VolumeRequest):
    if sys.platform == "darwin" and apple_ctrl.is_spotify_running():
        apple_ctrl.set_volume(req.volume_percent)
        return {"success": True, "engine": "applescript"}
    if sp_client.is_authenticated():
        sp_client.set_volume(req.volume_percent, device_id=req.device_id)
        return {"success": True}
    return {"success": False}

@app.get("/api/player/devices")
def get_player_devices():
    devices = sp_client.get_devices()
    return {"devices": devices}

@app.get("/api/player/state")
def get_player_state():
    if sys.platform == "darwin" and apple_ctrl.is_spotify_running():
        apple_state = apple_ctrl.get_current_status()
        if apple_state and apple_state.get("is_playing"):
            return apple_state
            
    if sp_client.is_authenticated():
        state = sp_client.get_current_playback_state()
        if state:
            return state
            
    if sys.platform == "darwin":
        apple_state = apple_ctrl.get_current_status()
        if apple_state:
            return apple_state
            
    return {"is_playing": False, "item": None, "engine": "none"}

# --- Static Frontend Serving ---

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
