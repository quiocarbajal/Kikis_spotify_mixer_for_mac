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
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = "http://127.0.0.1:8888/callback"

class ReorderRequest(BaseModel):
    playlist_id: Optional[str] = "default"
    track_ids: List[str]

class CreatePlaylistRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    track_ids: List[str]
    overwrite: Optional[bool] = False
    playlist_id: Optional[str] = None

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

class BooleanTerm(BaseModel):
    value: str
    id: Optional[str] = None
    modifier: str = "AND"  # "AND" or "NOT"

class DiscoveryMatrixRequest(BaseModel):
    artists: Optional[List[BooleanTerm]] = []
    tracks: Optional[List[BooleanTerm]] = []
    genres: Optional[List[BooleanTerm]] = []
    decades: Optional[List[BooleanTerm]] = []
    keywords: Optional[List[BooleanTerm]] = []
    use_active_vibe: Optional[bool] = False
    active_playlist_id: Optional[str] = None
    not_liked_songs: Optional[bool] = True
    not_in_playlists: Optional[bool] = True
    not_recently_played_days: Optional[int] = 30
    not_live: Optional[bool] = False
    not_remix: Optional[bool] = False
    only_live: Optional[bool] = False
    only_remix: Optional[bool] = False
    low_popularity_only: Optional[bool] = False
    hidden_gem_target: Optional[str] = "artist"
    target_count: Optional[int] = 30
    true_shuffle: Optional[bool] = True
    avoid_consecutive_artists: Optional[bool] = True

# --- API Endpoints ---

sync_state: Dict[str, Any] = {
    "is_syncing": False,
    "stage": "idle",  # "idle", "liked_songs", "playlists", "done", "error"
    "status_message": "",
    "liked_count": 0,
    "playlists_synced": 0,
    "total_playlists": 0,
    "error": None
}

@app.get("/api/status")
def get_status():
    auth = sp_client.is_authenticated()
    has_creds = bool((os.getenv("SPOTIFY_CLIENT_ID") and os.getenv("SPOTIFY_CLIENT_ID") != "your_client_id_here") or sp_client.DEFAULT_CLIENT_ID)
    is_mac = sys.platform == "darwin"
    mac_app_running = apple_ctrl.is_spotify_running() if is_mac else False
    local_ip = get_local_ip()
    port = os.getenv("PORT", "8888")
    total_local_tracks = db.get_total_track_count() if auth else 0
    liked_pl = next((p for p in db.get_playlists() if p["id"] == "liked_songs"), None) if auth else None
    liked_tracks = int(liked_pl.get("total_tracks", 0) or len(liked_pl.get("track_ids", []))) if liked_pl else 0
    
    return {
        "authenticated": auth,
        "has_credentials": has_creds,
        "is_mac": is_mac,
        "mac_spotify_running": mac_app_running,
        "local_ip": local_ip,
        "port": port,
        "access_url": f"http://{local_ip}:{port}",
        "is_syncing": sync_state["is_syncing"],
        "has_synced_tracks": total_local_tracks > 0,
        "total_tracks": total_local_tracks,
        "liked_tracks": liked_tracks
    }

@app.get("/api/sync/status")
def get_sync_status():
    return sync_state

@app.post("/api/credentials")
def save_credentials(creds: CredentialsRequest):
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    
    client_id = creds.client_id.strip() if creds.client_id else ""
    client_secret = creds.client_secret.strip() if creds.client_secret else ""
    redirect_uri = creds.redirect_uri.strip() if creds.redirect_uri else "http://127.0.0.1:8888/callback"
    
    os.environ["SPOTIFY_CLIENT_ID"] = client_id
    if client_secret:
        os.environ["SPOTIFY_CLIENT_SECRET"] = client_secret
    elif "SPOTIFY_CLIENT_SECRET" in os.environ:
        del os.environ["SPOTIFY_CLIENT_SECRET"]
    os.environ["SPOTIFY_REDIRECT_URI"] = redirect_uri
    
    with open(env_path, "w") as f:
        f.write(f"SPOTIFY_CLIENT_ID={client_id}\n")
        if client_secret:
            f.write(f"SPOTIFY_CLIENT_SECRET={client_secret}\n")
        f.write(f"SPOTIFY_REDIRECT_URI={redirect_uri}\n")
        f.write(f"HOST=0.0.0.0\nPORT=8888\nDATABASE_PATH=spotify_tags.db\n")
        
    return {"success": True, "message": "Credentials saved"}

@app.post("/api/spotify/launch")
def launch_spotify_app():
    if sys.platform == "darwin":
        apple_ctrl.launch_spotify()
        return {"success": True, "launched": True}
    return {"success": False, "detail": "Not on macOS"}

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

@app.post("/api/auth/logout")
def auth_logout():
    cache_path = sp_client.CACHE_PATH
    if os.path.exists(cache_path):
        try:
            os.remove(cache_path)
        except Exception:
            pass
    db.clear_all_data()
    return {"success": True, "message": "Logged out and library reset"}

# --- Search Catalog & Song Discovery ---

@app.get("/api/search")
def search_tracks(q: str = Query(..., min_length=1), type: str = "all"):
    # 1. Search Spotify Catalog with modifier
    catalog_results = sp_client.search_catalog(q, search_type=type, limit=25)
    if catalog_results:
        db.upsert_tracks(catalog_results)
    
    # 2. Also search local library
    local_results = db.get_tracks_query(search=q)
    
    # Combine (local tracks first, then catalog tracks)
    seen_ids = set()
    combined = []
    for t in local_results:
        seen_ids.add(t["id"])
        combined.append(t)
        
    for t in catalog_results:
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
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
        
    global sync_state
    sync_state["is_syncing"] = True
    sync_state["stage"] = "liked_songs"
    sync_state["status_message"] = "Fetching your Liked Songs from Spotify..."
    sync_state["error"] = None
    sync_state["liked_count"] = 0
    sync_state["playlists_synced"] = 0
    sync_state["total_playlists"] = 0

    try:
        liked_tracks, liked_warning = sp_client.fetch_all_liked_songs_with_status(limit=5000)
        sync_state["liked_count"] = len(liked_tracks)
        if liked_tracks:
            sync_state["status_message"] = f"Saving {len(liked_tracks)} Liked Songs to library..."
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
            sync_state["stage"] = "playlists"
            sync_state["status_message"] = "Fetching your Spotify playlists..."
            try:
                user_playlists = sp_client.fetch_all_playlists(limit=25)
                sync_state["total_playlists"] = len(user_playlists)
                db.upsert_playlists(user_playlists)
                
                # Fetch tracks for all user playlists
                for idx, p in enumerate(user_playlists):
                    try:
                        p_name = p.get("name", "Playlist")
                        sync_state["status_message"] = f"Syncing playlist '{p_name}' ({idx + 1}/{len(user_playlists)})..."
                        sync_state["playlists_synced"] = idx + 1
                        p_tracks = sp_client.fetch_playlist_tracks(p["id"], limit=200)
                        if p_tracks:
                            db.upsert_tracks(p_tracks)
                            db.set_playlist_tracks(p["id"], [t["id"] for t in p_tracks])
                    except Exception as pe:
                        print(f"Error syncing playlist {p.get('id')}: {pe}")
            except Exception as ple:
                print(f"Error fetching playlists: {ple}")
                    
        sync_state["is_syncing"] = False
        sync_state["stage"] = "done"
        sync_state["status_message"] = "Sync complete!"
        return {
            "success": True,
            "liked_count": len(liked_tracks),
            "playlists_count": sync_state["total_playlists"],
            "warning": liked_warning
        }
    except Exception as e:
        traceback.print_exc()
        sync_state["is_syncing"] = False
        sync_state["stage"] = "error"
        sync_state["error"] = str(e)
        sync_state["status_message"] = f"Sync error: {str(e)}"
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@app.get("/api/tracks")
def get_tracks(
    playlist_id: Optional[str] = None,
    search: Optional[str] = None,
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
    elif playlist_id == "liked_songs" or (not playlist_id and not search):
        existing = db.get_tracks_query(playlist_id="liked_songs")
        if not existing and sp_client.is_authenticated():
            liked_tracks, _ = sp_client.fetch_all_liked_songs_with_status(limit=500)
            if liked_tracks:
                db.upsert_tracks(liked_tracks)
                db.upsert_playlists([{
                    "id": "liked_songs",
                    "name": "Liked Songs",
                    "description": "Your saved Spotify tracks",
                    "image_url": "https://misc.scdn.co/liked-songs/liked-songs-300.png",
                    "total_tracks": len(liked_tracks),
                    "is_custom": 1
                }])
                db.set_playlist_tracks("liked_songs", [t["id"] for t in liked_tracks])

    tracks = db.get_tracks_query(
        playlist_id=playlist_id,
        search=search,
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
        
    tracks = db.get_tracks_query()
    track_map = {t["id"]: t for t in tracks}
    uris = [track_map[t_id]["uri"] if t_id in track_map else f"spotify:track:{t_id}" for t_id in req.track_ids]

    # Check for overwrite
    p_id = req.playlist_id
    if not p_id and req.overwrite:
        existing_p = next((p for p in db.get_all_playlists() if p["name"].strip().lower() == req.name.strip().lower()), None)
        if existing_p:
            p_id = existing_p["id"]

    if req.overwrite and p_id:
        # 1. Update database playlist tracks and total count
        db.set_playlist_tracks(p_id, req.track_ids)
        db.rename_playlist(p_id, req.name.strip())
        
        # 2. Overwrite on Spotify if authenticated and not a local-only custom ID
        if sp_client.is_authenticated() and not p_id.startswith("custom_") and p_id != "liked_songs":
            try:
                sp_client.overwrite_user_playlist(p_id, uris)
                sp = sp_client.get_spotify_client()
                if sp and req.description:
                    sp.playlist_change_details(p_id, description=req.description)
            except Exception as e:
                print(f"Spotify overwrite playlist error: {e}")
                
        return {"success": True, "overwritten": True, "playlist_id": p_id, "name": req.name.strip(), "total_tracks": len(req.track_ids)}

    # Brand new playlist
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

# --- "🎲 Surprise Me!" Discovery Endpoints ---

@app.get("/api/discovery/genres")
def get_discovery_genres(category: Optional[str] = None, q: Optional[str] = None):
    genres = sp_client.search_genres(query=q or "", category=category)
    return {"genres": genres, "count": len(genres)}

@app.get("/api/discovery/decades")
def get_discovery_decades():
    decades = [
        {"id": "60s", "name": "60s (1960–1969)"},
        {"id": "70s", "name": "70s (1970–1979)"},
        {"id": "80s", "name": "80s (1980–1989)"},
        {"id": "90s", "name": "90s (1990–1999)"},
        {"id": "00s", "name": "2000s (2000–2009)"},
        {"id": "10s", "name": "2010s (2010–2019)"},
        {"id": "20s", "name": "2020s (2020–2029)"},
        {"id": "fresh", "name": "Fresh / New (2024–2026)"}
    ]
    return {"decades": decades}

@app.get("/api/discovery/suggest")
def get_discovery_suggestions(q: str = Query(..., min_length=1), type: str = "artist", limit: int = 6):
    type_clean = type.lower().strip()
    if type_clean == "artist":
        results = sp_client.suggest_artists(q, limit=limit)
    elif type_clean == "track":
        results = sp_client.suggest_tracks(q, limit=limit)
    elif type_clean == "genre":
        results = sp_client.search_genres(query=q)
    else:
        results = []
    return {"results": results, "suggestions": results, "count": len(results)}

@app.get("/api/discovery/active-vibe")
def get_active_vibe(playlist_id: Optional[str] = None):
    vibe = db.get_active_playlist_vibe_seeds(playlist_id=playlist_id)
    return {"vibe": vibe}

@app.post("/api/discovery/generate")
def generate_discovery_mix(req: DiscoveryMatrixRequest):
    # 1. Fetch exclusion sets and canonical identities from local DB
    liked_ids_set = set(db.get_all_user_saved_track_ids()) if req.not_liked_songs else set()
    liked_identities_list = db.get_all_user_saved_track_identities() if req.not_liked_songs else []

    playlist_ids_set = set(db.get_all_playlist_track_ids()) if req.not_in_playlists else set()
    playlist_identities_list = db.get_all_playlist_track_identities() if req.not_in_playlists else []

    recent_ids_set = set(db.get_recently_played_ids(days=req.not_recently_played_days or 7)) if req.not_recently_played_days else set()
    recent_identities_list = db.get_recently_played_identities(days=req.not_recently_played_days or 7) if req.not_recently_played_days else []
    
    active_vibe_seeds = None
    if req.use_active_vibe:
        active_vibe_seeds = db.get_active_playlist_vibe_seeds(playlist_id=req.active_playlist_id)

    # Convert Pydantic models to dicts
    artists_list = [term.model_dump() for term in (req.artists or [])]
    tracks_list = [term.model_dump() for term in (req.tracks or [])]
    genres_list = [term.model_dump() for term in (req.genres or [])]
    decades_list = [term.model_dump() for term in (req.decades or [])]
    keywords_list = [term.model_dump() for term in (req.keywords or [])]

    # 2. Run boolean matrix discovery engine
    result = sp_client.discover_boolean_matrix(
        artists=artists_list,
        tracks=tracks_list,
        genres=genres_list,
        decades=decades_list,
        keywords=keywords_list,
        use_active_vibe=bool(req.use_active_vibe),
        active_vibe_seeds=active_vibe_seeds,
        not_liked_songs=bool(req.not_liked_songs),
        not_in_playlists=bool(req.not_in_playlists),
        not_recently_played_days=req.not_recently_played_days,
        not_live=bool(req.not_live),
        not_remix=bool(req.not_remix),
        only_live=bool(req.only_live),
        only_remix=bool(req.only_remix),
        low_popularity_only=bool(req.low_popularity_only),
        hidden_gem_target=req.hidden_gem_target or "artist",
        target_count=req.target_count or 30,
        true_shuffle=bool(req.true_shuffle),
        avoid_consecutive_artists=bool(req.avoid_consecutive_artists),
        liked_ids_set=liked_ids_set,
        playlist_ids_set=playlist_ids_set,
        recent_ids_set=recent_ids_set,
        liked_identities_list=liked_identities_list,
        playlist_identities_list=playlist_identities_list,
        recent_identities_list=recent_identities_list
    )

    # 3. Upsert discovered tracks to DB tracks table
    if result.get("tracks"):
        db.upsert_tracks(result["tracks"])

    return result

# --- Playback & True Random Controller ---

@app.post("/api/player/play")
def play_track_selection(req: PlayRequest):
    uris = req.uris
    if not uris:
        raise HTTPException(status_code=400, detail="No track URIs provided")
        
    # Record playback history for all played tracks
    for uri in uris:
        if "spotify:track:" in uri:
            t_id = uri.split(":")[-1]
            db.record_playback(t_id)

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
            if apple_state.get("item") and apple_state["item"].get("id"):
                db.record_playback(apple_state["item"]["id"])
            return apple_state
            
    if sp_client.is_authenticated():
        state = sp_client.get_current_playback_state()
        if state:
            if state.get("is_playing") and state.get("item") and state["item"].get("id"):
                db.record_playback(state["item"]["id"])
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
