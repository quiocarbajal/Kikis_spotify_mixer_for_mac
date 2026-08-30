import os
import time
import random
import spotipy
from spotipy.oauth2 import SpotifyOAuth, CacheFileHandler
from typing import Optional, Dict, Any, List, Tuple
from dotenv import load_dotenv

load_dotenv()

SCOPES = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-library-read",
    "user-library-modify"
]

def get_user_data_dir() -> str:
    app_data = os.getenv("APP_DATA_DIR")
    if app_data and os.path.isdir(app_data):
        return app_data
    local_cache = os.path.join(os.path.dirname(__file__), "..", ".spotify_cache")
    if os.path.exists(local_cache) and os.access(os.path.dirname(local_cache), os.W_OK):
        return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    app_support = os.path.expanduser("~/Library/Application Support/KikisSpotifyMixer")
    try:
        os.makedirs(app_support, exist_ok=True)
        return app_support
    except Exception:
        return "."

DATA_DIR = get_user_data_dir()
CACHE_PATH = os.path.join(DATA_DIR, ".spotify_cache")

_playback_cache: Optional[Dict[str, Any]] = None
_last_playback_time: float = 0.0
PLAYBACK_CACHE_TTL = 3.0  # seconds

DEFAULT_CLIENT_ID = "5422e5d127b845198527048f9f7529cf"
DEFAULT_CLIENT_SECRET = ""
DEFAULT_REDIRECT_URI = "http://127.0.0.1:8888/callback"

def get_cache_handler() -> CacheFileHandler:
    return CacheFileHandler(cache_path=CACHE_PATH)

def get_spotify_oauth() -> Optional[SpotifyOAuth]:
    client_id = os.getenv("SPOTIFY_CLIENT_ID") or DEFAULT_CLIENT_ID
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET") or DEFAULT_CLIENT_SECRET
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", DEFAULT_REDIRECT_URI)
    
    if not client_id or not client_secret or client_id == "your_client_id_here":
        client_id = DEFAULT_CLIENT_ID
        client_secret = DEFAULT_CLIENT_SECRET
        
    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=" ".join(SCOPES),
        cache_handler=get_cache_handler(),
        open_browser=False
    )

def get_spotify_client() -> Optional[spotipy.Spotify]:
    oauth = get_spotify_oauth()
    if not oauth:
        return None
    cache_handler = get_cache_handler()
    token_info = cache_handler.get_cached_token()
    if not token_info or not isinstance(token_info, dict) or "access_token" not in token_info:
        return None
    if oauth.is_token_expired(token_info):
        try:
            token_info = oauth.refresh_access_token(token_info["refresh_token"])
        except Exception as e:
            err_msg = str(e).lower()
            # Only delete cache if refresh token was explicitly revoked by Spotify
            if "invalid_grant" in err_msg or "revoked" in err_msg:
                try:
                    if os.path.exists(CACHE_PATH):
                        os.remove(CACHE_PATH)
                except Exception:
                    pass
            return None
            
    return spotipy.Spotify(
        auth=token_info["access_token"],
        requests_timeout=5,
        retries=0,
        status_retries=0
    )

def is_authenticated() -> bool:
    sp = get_spotify_client()
    return sp is not None

# --- True Mathematical Random Shuffle Engine (Fisher-Yates) ---

def fisher_yates_true_shuffle(
    items: List[Any],
    avoid_consecutive_artists: bool = False,
    artist_lookup: Optional[Dict[str, str]] = None
) -> List[Any]:
    if not items:
        return []
    shuffled = items.copy()
    rng = random.SystemRandom()
    n = len(shuffled)
    
    for i in range(n - 1, 0, -1):
        j = rng.randint(0, i)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        
    if avoid_consecutive_artists and artist_lookup and len(shuffled) > 2:
        for i in range(len(shuffled) - 1):
            art1 = artist_lookup.get(shuffled[i])
            art2 = artist_lookup.get(shuffled[i + 1])
            if art1 and art2 and art1 == art2:
                for k in range(i + 2, min(len(shuffled), i + 10)):
                    art_k = artist_lookup.get(shuffled[k])
                    if art_k != art1:
                        shuffled[i + 1], shuffled[k] = shuffled[k], shuffled[i + 1]
                        break
                        
    return shuffled

# --- Playback Operations (Background playback, zero focus stealing) ---

def get_target_device_id(sp: spotipy.Spotify, device_id: Optional[str] = None) -> Optional[str]:
    if device_id:
        return device_id
    try:
        devs = sp.devices().get("devices", [])
        if devs:
            active = next((d for d in devs if d.get("is_active")), devs[0])
            return active.get("id")
    except Exception:
        pass
    return None

def play_tracks(track_uris: List[str], device_id: Optional[str] = None) -> Dict[str, Any]:
    sp = get_spotify_client()
    if not sp:
        return {"success": False, "error": "Not authenticated with Spotify"}
    if not track_uris:
        return {"success": False, "error": "No tracks provided"}
    try:
        target_dev = get_target_device_id(sp, device_id)
        try:
            sp.shuffle(state=False, device_id=target_dev)
        except Exception:
            pass
        batch = track_uris[:100]
        sp.start_playback(device_id=target_dev, uris=batch, offset={"position": 0})
        global _last_playback_time
        _last_playback_time = 0.0
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def pause(device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.pause_playback(device_id=target_dev)
        global _last_playback_time
        _last_playback_time = 0.0
        return True
    except Exception:
        return False

def resume(device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.start_playback(device_id=target_dev)
        global _last_playback_time
        _last_playback_time = 0.0
        return True
    except Exception:
        return False

def next_track(device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.next_track(device_id=target_dev)
        global _last_playback_time
        _last_playback_time = 0.0
        return True
    except Exception:
        return False

def previous_track(device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.previous_track(device_id=target_dev)
        global _last_playback_time
        _last_playback_time = 0.0
        return True
    except Exception:
        return False

def seek(position_ms: int, device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.seek_track(position_ms=position_ms, device_id=target_dev)
        return True
    except Exception:
        return False

def set_volume(volume_percent: int, device_id: Optional[str] = None) -> bool:
    sp = get_spotify_client()
    if not sp:
        return False
    try:
        target_dev = get_target_device_id(sp, device_id)
        sp.volume(volume_percent=volume_percent, device_id=target_dev)
        return True
    except Exception:
        return False

def get_devices() -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not sp:
        return []
    try:
        res = sp.devices()
        return res.get("devices", []) or []
    except Exception:
        return []

def get_current_playback_state() -> Optional[Dict[str, Any]]:
    global _playback_cache, _last_playback_time
    
    now = time.time()
    if _playback_cache is not None and (now - _last_playback_time) < PLAYBACK_CACHE_TTL:
        return _playback_cache

    sp = get_spotify_client()
    if not sp:
        return None
        
    try:
        playback = sp.current_playback()
        _last_playback_time = now
        if not playback or not playback.get("item"):
            _playback_cache = {"is_playing": False, "item": None, "engine": "spotify_web_api"}
            return _playback_cache
            
        item = playback["item"]
        if not isinstance(item, dict):
            return None
            
        artists_str = ", ".join([a["name"] for a in item.get("artists", []) if isinstance(a, dict) and a.get("name")])
        
        _playback_cache = {
            "is_playing": playback.get("is_playing", False),
            "progress_ms": playback.get("progress_ms", 0) or 0,
            "duration_ms": item.get("duration_ms", 0) or 0,
            "device": playback.get("device", {}) or {},
            "item": {
                "id": item.get("id"),
                "uri": item.get("uri"),
                "title": item.get("name", "Unknown Title"),
                "artist": artists_str or "Unknown Artist",
                "album": (item.get("album", {}) or {}).get("name", "Unknown Album"),
                "album_art_url": "",
                "duration_ms": item.get("duration_ms", 0) or 0
            },
            "engine": "spotify_web_api"
        }
        return _playback_cache
    except Exception:
        return _playback_cache

# --- Search & Sync ---

def search_catalog(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not sp or not query.strip():
        return []
    try:
        res = sp.search(q=query.strip(), limit=limit, type="track")
        if not res or "tracks" not in res:
            return []
        items = res["tracks"].get("items", []) or []
        tracks = []
        for t in items:
            if not t or not isinstance(t, dict) or not t.get("id"):
                continue
            artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
            tracks.append({
                "id": t["id"],
                "uri": t.get("uri", f"spotify:track:{t['id']}"),
                "title": t.get("name", "Unknown Title"),
                "artist": artists_str or "Unknown Artist",
                "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
                "album_art_url": "",
                "duration_ms": t.get("duration_ms", 0) or 0
            })
        return tracks
    except Exception as e:
        print(f"Catalog search error: {e}")
        return []

def fetch_all_liked_songs_with_status(limit: int = 5000) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    sp = get_spotify_client()
    if not sp:
        return [], "Not authenticated"
    tracks = []
    offset = 0
    batch_size = 50
    error_msg = None
    
    while offset < limit:
        try:
            res = sp.current_user_saved_tracks(limit=batch_size, offset=offset)
            if not res or not isinstance(res, dict):
                break
            items = res.get("items", []) or []
            if not items:
                break
            for entry in items:
                if not entry or not isinstance(entry, dict):
                    continue
                t = entry.get("track")
                if not t or not isinstance(t, dict) or not t.get("id"):
                    continue
                artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                images = (t.get("album", {}) or {}).get("images", [])
                art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                tracks.append({
                    "id": t["id"],
                    "uri": t.get("uri", f"spotify:track:{t['id']}"),
                    "title": t.get("name", "Unknown Title"),
                    "artist": artists_str or "Unknown Artist",
                    "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
                    "album_art_url": art_url,
                    "duration_ms": t.get("duration_ms", 0) or 0
                })
            offset += len(items)
            if len(items) < batch_size:
                break
            time.sleep(0.05)  # Throttling to prevent 429
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate limit" in err_str.lower():
                error_msg = "Spotify API temporary rate limit reached on this Client ID. Please wait or create a fresh Client ID in Spotify Dashboard."
            else:
                error_msg = f"Error fetching saved tracks: {e}"
            print(f"fetch_all_liked_songs error at offset {offset}: {e}")
            break
    return tracks, error_msg

def fetch_all_liked_songs(limit: int = 5000) -> List[Dict[str, Any]]:
    tracks, _ = fetch_all_liked_songs_with_status(limit=limit)
    return tracks

def fetch_all_playlists(limit: int = 50) -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not sp:
        return []
    playlists = []
    try:
        res = sp.current_user_playlists(limit=limit)
        if res and isinstance(res, dict):
            for p in res.get("items", []) or []:
                if not p or not isinstance(p, dict) or not p.get("id"):
                    continue
                playlists.append({
                    "id": p["id"],
                    "name": p.get("name", "Untitled Playlist"),
                    "description": p.get("description", "") or "",
                    "image_url": "",
                    "total_tracks": (p.get("tracks", {}) or {}).get("total", 0) or 0,
                    "is_custom": 0
                })
    except Exception as e:
        print(f"Error fetching user playlists: {e}")
    return playlists

def fetch_playlist_tracks(playlist_id: str, limit: int = 300) -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not sp:
        return []
    tracks = []
    offset = 0
    batch_size = 50
    
    while offset < limit:
        try:
            res = sp.playlist_tracks(playlist_id=playlist_id, limit=batch_size, offset=offset, additional_types=('track',))
            if not res or not isinstance(res, dict):
                break
            items = res.get("items", []) or []
            if not items:
                break
            for entry in items:
                if not entry or not isinstance(entry, dict):
                    continue
                t = entry.get("item") or entry.get("track")
                if not t or not isinstance(t, dict) or not t.get("id"):
                    continue
                artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                images = (t.get("album", {}) or {}).get("images", [])
                art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                tracks.append({
                    "id": t["id"],
                    "uri": t.get("uri", f"spotify:track:{t['id']}"),
                    "title": t.get("name", "Unknown Title"),
                    "artist": artists_str or "Unknown Artist",
                    "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
                    "album_art_url": art_url,
                    "duration_ms": t.get("duration_ms", 0) or 0
                })
            offset += len(items)
            if len(items) < batch_size:
                break
        except Exception as e:
            print(f"Error fetching playlist tracks: {e}")
            break
    return tracks

def search_lyrics(query: str, limit: int = 15) -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not query.strip():
        return []
    
    tracks = []
    seen_ids = set()
    
    # 1. Query LRCLIB lyrics database
    try:
        import requests
        res = requests.get("https://lrclib.net/api/search", params={"q": query.strip()}, timeout=4)
        if res.status_code == 200:
            lyric_items = res.json()
            for item in lyric_items[:8]:
                t_name = item.get("trackName")
                a_name = item.get("artistName")
                if not t_name:
                    continue
                # Resolve in Spotify
                if sp:
                    try:
                        spot_res = sp.search(q=f"track:{t_name} artist:{a_name}", type="track", limit=1)
                        s_items = (spot_res.get("tracks", {}) or {}).get("items", []) or []
                        if s_items:
                            st = s_items[0]
                            if st.get("id") and st["id"] not in seen_ids:
                                seen_ids.add(st["id"])
                                artists_str = ", ".join([a["name"] for a in st.get("artists", []) if isinstance(a, dict) and a.get("name")])
                                images = (st.get("album", {}) or {}).get("images", [])
                                art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                                tracks.append({
                                    "id": st["id"],
                                    "uri": st.get("uri", f"spotify:track:{st['id']}"),
                                    "title": st.get("name", t_name),
                                    "artist": artists_str or a_name,
                                    "album": (st.get("album", {}) or {}).get("name", "Unknown Album"),
                                    "album_art_url": art_url,
                                    "duration_ms": st.get("duration_ms", 0) or 0
                                })
                    except Exception:
                        pass
    except Exception as e:
        print(f"Lyrics search error: {e}")
        
    # 2. Also search Spotify catalog directly
    if len(tracks) < limit and sp:
        try:
            res = sp.search(q=query.strip(), type="track", limit=10)
            items = (res.get("tracks", {}) or {}).get("items", []) or []
            for t in items:
                if not t or not t.get("id") or t["id"] in seen_ids:
                    continue
                seen_ids.add(t["id"])
                artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                images = (t.get("album", {}) or {}).get("images", [])
                art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                tracks.append({
                    "id": t["id"],
                    "uri": t.get("uri", f"spotify:track:{t['id']}"),
                    "title": t.get("name", "Unknown Title"),
                    "artist": artists_str or "Unknown Artist",
                    "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
                    "album_art_url": art_url,
                    "duration_ms": t.get("duration_ms", 0) or 0
                })
        except Exception:
            pass
            
    return tracks[:limit]

def search_catalog(query: str, search_type: str = "all", limit: int = 20) -> List[Dict[str, Any]]:
    if not query.strip():
        return []
        
    if search_type == "lyrics":
        return search_lyrics(query, limit=limit)
        
    sp = get_spotify_client()
    if not sp:
        return []
    
    q = query.strip()
    if search_type == "track":
        q = f"track:{q}"
    elif search_type == "artist":
        q = f"artist:{q}"
        
    tracks = []
    seen_ids = set()
    
    # Fetch in batches of 10 (Spotify dev api limit)
    for offset in range(0, min(limit, 30), 10):
        try:
            res = sp.search(q=q, type="track", limit=10, offset=offset)
            items = (res.get("tracks", {}) or {}).get("items", []) or []
            if not items:
                break
            for t in items:
                if not t or not t.get("id") or t["id"] in seen_ids:
                    continue
                seen_ids.add(t["id"])
                artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                images = (t.get("album", {}) or {}).get("images", [])
                art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                tracks.append({
                    "id": t["id"],
                    "uri": t.get("uri", f"spotify:track:{t['id']}"),
                    "title": t.get("name", "Unknown Title"),
                    "artist": artists_str or "Unknown Artist",
                    "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
                    "album_art_url": art_url,
                    "duration_ms": t.get("duration_ms", 0) or 0
                })
            if len(items) < 10:
                break
        except Exception as e:
            print(f"Search batch error at offset {offset}: {e}")
            break
            
    # STRICT FILTERING ONLY - NO MIXING, NO FALLBACKS
    raw_query = query.strip().lower()
    if search_type == "track":
        return [t for t in tracks if raw_query in t["title"].lower()]
    elif search_type == "artist":
        return [t for t in tracks if raw_query in t["artist"].lower()]
    elif search_type == "all":
        return [t for t in tracks if (raw_query in t["title"].lower() or raw_query in t["artist"].lower() or raw_query in t["album"].lower())]
        
    return tracks

def create_user_playlist(name: str, description: str, track_uris: List[str]) -> Dict[str, Any]:
    sp = get_spotify_client()
    if not sp:
        return {"success": False, "error": "Not authenticated with Spotify"}
    try:
        user = sp.current_user()
        playlist = sp.user_playlist_create(
            user=user["id"],
            name=name.strip(),
            public=False,
            description=description or "Created with Kiki's Spotify Mixer"
        )
        p_id = playlist["id"]
        
        if track_uris:
            for i in range(0, len(track_uris), 100):
                sp.playlist_add_items(playlist_id=p_id, items=track_uris[i:i+100])
                
        return {
            "success": True,
            "playlist": {
                "id": p_id,
                "name": name.strip(),
                "description": description,
                "total_tracks": len(track_uris),
                "image_url": ""
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
