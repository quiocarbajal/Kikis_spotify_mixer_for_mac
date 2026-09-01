import os
import re
import time
import random
import unicodedata
from datetime import datetime
import spotipy
from spotipy.oauth2 import SpotifyOAuth, CacheFileHandler
from typing import Optional, Dict, Any, List, Tuple, Set
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
    "user-library-modify",
    "user-read-recently-played",
    "user-top-read"
]

def get_user_data_dir() -> str:
    app_data = os.getenv("APP_DATA_DIR")
    if app_data and os.path.isdir(app_data):
        return app_data
    
    app_support = os.path.expanduser("~/Library/Application Support/KikisSpotifyMixer")
    try:
        os.makedirs(app_support, exist_ok=True)
        return app_support
    except Exception:
        pass
        
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

DATA_DIR = get_user_data_dir()
CACHE_PATH = os.getenv("SPOTIFY_CACHE_PATH", os.path.join(DATA_DIR, ".spotify_cache"))

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

def overwrite_user_playlist(playlist_id: str, track_uris: List[str]) -> Dict[str, Any]:
    """Overwrites an existing Spotify playlist with a new set of track URIs."""
    sp = get_spotify_client()
    if not sp:
        return {"success": False, "error": "Not authenticated with Spotify"}
    try:
        # Spotify allows replacing tracks with user_playlist_replace_tracks or playlist_replace_items (first batch up to 100)
        first_batch = track_uris[:100] if track_uris else []
        sp.playlist_replace_items(playlist_id=playlist_id, items=first_batch)
        
        # Add remaining batches if more than 100
        for i in range(100, len(track_uris), 100):
            sp.playlist_add_items(playlist_id=playlist_id, items=track_uris[i:i+100])
            
        return {"success": True, "playlist_id": playlist_id, "total_tracks": len(track_uris)}
    except Exception as e:
        print(f"Spotify overwrite playlist error: {e}")
        return {"success": False, "error": str(e)}

# --- "🎲 Surprise Me!" Discovery Engine & Typeahead Matrix ---

GENRE_CATALOG: List[Dict[str, str]] = [
    # Popular / Core
    {"id": "pop", "name": "Pop", "category": "Popular"},
    {"id": "rock", "name": "Rock", "category": "Popular"},
    {"id": "indie", "name": "Indie", "category": "Popular"},
    {"id": "hip-hop", "name": "Hip-Hop", "category": "Popular"},
    {"id": "electronic", "name": "Electronic", "category": "Popular"},
    {"id": "r-n-b", "name": "R&B", "category": "Popular"},
    {"id": "latin", "name": "Latin", "category": "Popular"},
    {"id": "dance", "name": "Dance", "category": "Popular"},
    {"id": "house", "name": "House", "category": "Popular"},
    {"id": "chill", "name": "Chill", "category": "Popular"},
    {"id": "alternative", "name": "Alternative", "category": "Popular"},
    
    # Rock & Indie
    {"id": "alt-rock", "name": "Alt Rock", "category": "Rock & Indie"},
    {"id": "indie-pop", "name": "Indie Pop", "category": "Rock & Indie"},
    {"id": "grunge", "name": "Grunge", "category": "Rock & Indie"},
    {"id": "punk", "name": "Punk", "category": "Rock & Indie"},
    {"id": "punk-rock", "name": "Punk Rock", "category": "Rock & Indie"},
    {"id": "hard-rock", "name": "Hard Rock", "category": "Rock & Indie"},
    {"id": "psych-rock", "name": "Psych Rock", "category": "Rock & Indie"},
    {"id": "power-pop", "name": "Power Pop", "category": "Rock & Indie"},
    {"id": "emo", "name": "Emo", "category": "Rock & Indie"},
    {"id": "goth", "name": "Goth", "category": "Rock & Indie"},
    {"id": "guitar", "name": "Guitar", "category": "Rock & Indie"},
    {"id": "post-dubstep", "name": "Post-Rock/Dub", "category": "Rock & Indie"},
    
    # Electronic & Dance
    {"id": "techno", "name": "Techno", "category": "Electronic & Dance"},
    {"id": "deep-house", "name": "Deep House", "category": "Electronic & Dance"},
    {"id": "synth-pop", "name": "Synth-Pop", "category": "Electronic & Dance"},
    {"id": "disco", "name": "Disco", "category": "Electronic & Dance"},
    {"id": "edm", "name": "EDM", "category": "Electronic & Dance"},
    {"id": "electro", "name": "Electro", "category": "Electronic & Dance"},
    {"id": "trance", "name": "Trance", "category": "Electronic & Dance"},
    {"id": "dubstep", "name": "Dubstep", "category": "Electronic & Dance"},
    {"id": "drum-and-bass", "name": "Drum & Bass", "category": "Electronic & Dance"},
    {"id": "club", "name": "Club", "category": "Electronic & Dance"},
    {"id": "breakbeat", "name": "Breakbeat", "category": "Electronic & Dance"},
    {"id": "minimal-techno", "name": "Minimal Techno", "category": "Electronic & Dance"},
    {"id": "progressive-house", "name": "Progressive House", "category": "Electronic & Dance"},
    {"id": "idm", "name": "IDM / Brainwave", "category": "Electronic & Dance"},
    {"id": "trip-hop", "name": "Trip-Hop", "category": "Electronic & Dance"},
    {"id": "chicago-house", "name": "Chicago House", "category": "Electronic & Dance"},
    {"id": "detroit-techno", "name": "Detroit Techno", "category": "Electronic & Dance"},
    {"id": "garage", "name": "UK Garage", "category": "Electronic & Dance"},
    {"id": "hardstyle", "name": "Hardstyle", "category": "Electronic & Dance"},
    
    # Hip-Hop & R&B
    {"id": "soul", "name": "Soul", "category": "Hip-Hop & R&B"},
    {"id": "funk", "name": "Funk", "category": "Hip-Hop & R&B"},
    {"id": "groove", "name": "Groove", "category": "Hip-Hop & R&B"},
    {"id": "gospel", "name": "Gospel", "category": "Hip-Hop & R&B"},
    
    # Latin & World
    {"id": "latino", "name": "Latino Hits", "category": "Latin & World"},
    {"id": "reggaeton", "name": "Reggaeton", "category": "Latin & World"},
    {"id": "salsa", "name": "Salsa", "category": "Latin & World"},
    {"id": "samba", "name": "Samba", "category": "Latin & World"},
    {"id": "tango", "name": "Tango", "category": "Latin & World"},
    {"id": "bossanova", "name": "Bossa Nova", "category": "Latin & World"},
    {"id": "mpb", "name": "MPB (Música Popular Brasileira)", "category": "Latin & World"},
    {"id": "pagode", "name": "Pagode", "category": "Latin & World"},
    {"id": "sertanejo", "name": "Sertanejo", "category": "Latin & World"},
    {"id": "forro", "name": "Forró", "category": "Latin & World"},
    {"id": "brazil", "name": "Brazil Vibe", "category": "Latin & World"},
    {"id": "afrobeat", "name": "Afrobeat", "category": "Latin & World"},
    {"id": "reggae", "name": "Reggae", "category": "Latin & World"},
    {"id": "dancehall", "name": "Dancehall", "category": "Latin & World"},
    {"id": "ska", "name": "Ska", "category": "Latin & World"},
    {"id": "world-music", "name": "World Music", "category": "Latin & World"},
    {"id": "spanish", "name": "Spanish Hits", "category": "Latin & World"},
    
    # Chill & Acoustic
    {"id": "acoustic", "name": "Acoustic", "category": "Chill & Acoustic"},
    {"id": "ambient", "name": "Ambient", "category": "Chill & Acoustic"},
    {"id": "folk", "name": "Folk", "category": "Chill & Acoustic"},
    {"id": "singer-songwriter", "name": "Singer-Songwriter", "category": "Chill & Acoustic"},
    {"id": "piano", "name": "Piano", "category": "Chill & Acoustic"},
    {"id": "study", "name": "Study Beats", "category": "Chill & Acoustic"},
    {"id": "sleep", "name": "Sleep", "category": "Chill & Acoustic"},
    {"id": "rainy-day", "name": "Rainy Day", "category": "Chill & Acoustic"},
    {"id": "road-trip", "name": "Road Trip", "category": "Chill & Acoustic"},
    {"id": "summer", "name": "Summer", "category": "Chill & Acoustic"},
    {"id": "romance", "name": "Romance", "category": "Chill & Acoustic"},
    {"id": "sad", "name": "Melancholy / Sad", "category": "Chill & Acoustic"},
    {"id": "new-age", "name": "New Age", "category": "Chill & Acoustic"},
    
    # Jazz & Classical
    {"id": "jazz", "name": "Jazz", "category": "Jazz & Classical"},
    {"id": "blues", "name": "Blues", "category": "Jazz & Classical"},
    {"id": "classical", "name": "Classical", "category": "Jazz & Classical"},
    {"id": "opera", "name": "Opera", "category": "Jazz & Classical"},
    
    # Metal & Hard
    {"id": "metal", "name": "Metal", "category": "Metal & Hard"},
    {"id": "heavy-metal", "name": "Heavy Metal", "category": "Metal & Hard"},
    {"id": "metalcore", "name": "Metalcore", "category": "Metal & Hard"},
    {"id": "black-metal", "name": "Black Metal", "category": "Metal & Hard"},
    {"id": "death-metal", "name": "Death Metal", "category": "Metal & Hard"},
    {"id": "grindcore", "name": "Grindcore", "category": "Metal & Hard"},
    {"id": "hardcore", "name": "Hardcore", "category": "Metal & Hard"},
    {"id": "industrial", "name": "Industrial", "category": "Metal & Hard"},
    
    # Asian Pop
    {"id": "k-pop", "name": "K-Pop", "category": "Asian Pop"},
    {"id": "j-pop", "name": "J-Pop", "category": "Asian Pop"},
    {"id": "j-rock", "name": "J-Rock", "category": "Asian Pop"},
    {"id": "j-dance", "name": "J-Dance", "category": "Asian Pop"},
    {"id": "j-idol", "name": "J-Idol", "category": "Asian Pop"},
    {"id": "cantopop", "name": "Cantopop", "category": "Asian Pop"},
    {"id": "mandopop", "name": "Mandopop", "category": "Asian Pop"},
    {"id": "anime", "name": "Anime Soundtracks", "category": "Asian Pop"},
    {"id": "philippines-opm", "name": "Pinoy OPM", "category": "Asian Pop"},
    {"id": "malay", "name": "Malay Hits", "category": "Asian Pop"},
    {"id": "indian", "name": "Indian / Bollywood", "category": "Asian Pop"},
    
    # Decades & Roots
    {"id": "rock-n-roll", "name": "Rock & Roll", "category": "Decades & Roots"},
    {"id": "rockabilly", "name": "Rockabilly", "category": "Decades & Roots"},
    {"id": "bluegrass", "name": "Bluegrass", "category": "Decades & Roots"},
    {"id": "country", "name": "Country", "category": "Decades & Roots"},
    {"id": "honky-tonk", "name": "Honky-Tonk", "category": "Decades & Roots"},
    {"id": "show-tunes", "name": "Show Tunes / Broadway", "category": "Decades & Roots"},
    {"id": "soundtracks", "name": "Movie Soundtracks", "category": "Decades & Roots"},
]

DECADE_MAP: Dict[str, Tuple[int, int]] = {
    "60s": (1960, 1969),
    "70s": (1970, 1979),
    "80s": (1980, 1989),
    "90s": (1990, 1999),
    "00s": (2000, 2009),
    "2000s": (2000, 2009),
    "10s": (2010, 2019),
    "2010s": (2010, 2019),
    "20s": (2020, 2029),
    "2020s": (2020, 2029),
    "fresh": (2024, 2026),
}

def search_genres(query: str = "", category: Optional[str] = None) -> List[Dict[str, str]]:
    q = query.strip().lower()
    results = []
    for g in GENRE_CATALOG:
        if category and category.lower() != "all" and g["category"].lower() != category.lower():
            continue
        if not q or q in g["id"].lower() or q in g["name"].lower() or q in g["category"].lower():
            results.append(g)
    return results

def suggest_artists(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    results = []
    seen_names = set()
    sp = get_spotify_client()
    if sp and query.strip():
        try:
            res = sp.search(q=query.strip(), type="artist", limit=limit)
            items = (res.get("artists", {}) or {}).get("items", []) or []
            for a in items:
                if not a or not a.get("id"):
                    continue
                name = a.get("name", "Unknown Artist")
                if name.lower() not in seen_names:
                    seen_names.add(name.lower())
                    images = a.get("images", [])
                    img_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                    genres_list = a.get("genres", [])
                    sub = ", ".join(genres_list[:2]).title() if genres_list else "Artist"
                    results.append({
                        "id": a["id"],
                        "name": name,
                        "title": name,
                        "artist": name,
                        "subtitle": sub,
                        "image_url": img_url,
                        "album_art_url": img_url,
                        "followers": (a.get("followers", {}) or {}).get("total", 0)
                    })
        except Exception as e:
            print(f"suggest_artists error: {e}")

    # Local database fallback
    if len(results) < limit:
        try:
            try:
                import database as db
            except ImportError:
                from backend import database as db
            loc_tracks = db.get_tracks_query(search=query.strip())
            for t in loc_tracks:
                if len(results) >= limit:
                    break
                for single_art in t.get("artist", "").split(","):
                    art_name = single_art.strip()
                    if art_name and query.strip().lower() in art_name.lower() and art_name.lower() not in seen_names:
                        seen_names.add(art_name.lower())
                        results.append({
                            "id": None,
                            "name": art_name,
                            "title": art_name,
                            "artist": art_name,
                            "subtitle": "In Your Library",
                            "image_url": t.get("album_art_url", ""),
                            "album_art_url": t.get("album_art_url", "")
                        })
        except Exception:
            pass

    return results[:limit]

def suggest_tracks(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    results = []
    seen_ids = set()
    sp = get_spotify_client()
    if sp and query.strip():
        try:
            res = sp.search(q=query.strip(), type="track", limit=limit)
            items = (res.get("tracks", {}) or {}).get("items", []) or []
            for t in items:
                if not t or not t.get("id"):
                    continue
                t_id = t["id"]
                if t_id not in seen_ids:
                    seen_ids.add(t_id)
                    title = t.get("name", "Unknown Title")
                    artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                    album_name = (t.get("album", {}) or {}).get("name", "Unknown Album")
                    images = (t.get("album", {}) or {}).get("images", [])
                    img_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
                    results.append({
                        "id": t_id,
                        "uri": t.get("uri", f"spotify:track:{t_id}"),
                        "name": title,
                        "title": title,
                        "artist": artists_str or "Unknown Artist",
                        "album": album_name,
                        "subtitle": f"{artists_str} • {album_name}",
                        "image_url": img_url,
                        "album_art_url": img_url,
                        "duration_ms": t.get("duration_ms", 0) or 0
                    })
        except Exception as e:
            print(f"suggest_tracks error: {e}")

    # Local database fallback
    if len(results) < limit:
        try:
            try:
                import database as db
            except ImportError:
                from backend import database as db
            loc_tracks = db.get_tracks_query(search=query.strip())
            for t in loc_tracks:
                if len(results) >= limit:
                    break
                t_id = t.get("id")
                if t_id and t_id not in seen_ids:
                    seen_ids.add(t_id)
                    title = t.get("title", "Unknown Title")
                    artist = t.get("artist", "Unknown Artist")
                    album = t.get("album", "Unknown Album")
                    results.append({
                        "id": t_id,
                        "uri": t.get("uri") or f"spotify:track:{t_id}",
                        "name": title,
                        "title": title,
                        "artist": artist,
                        "album": album,
                        "subtitle": f"{artist} • {album} (Library)",
                        "image_url": t.get("album_art_url", ""),
                        "album_art_url": t.get("album_art_url", ""),
                        "duration_ms": t.get("duration_ms", 0)
                    })
        except Exception:
            pass

    return results[:limit]

def get_recently_played_spotify(limit: int = 50) -> List[Dict[str, Any]]:
    sp = get_spotify_client()
    if not sp:
        return []
    try:
        res = sp.current_user_recently_played(limit=limit)
        items = res.get("items", []) or []
        recent_tracks = []
        for item in items:
            t = item.get("track")
            if t and t.get("id"):
                artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
                recent_tracks.append({
                    "id": t["id"],
                    "title": t.get("name", ""),
                    "artist": artists_str or ""
                })
        return recent_tracks
    except Exception as e:
        print(f"get_recently_played_spotify error: {e}")
        return []

def normalize_song_title(title: str) -> str:
    """Canonical title normalization to match songs regardless of album/remaster/deluxe/live version."""
    if not title:
        return ""
    s = title.strip().lower()
    # Strip common edition/remaster/version suffixes in parentheses or brackets
    s = re.sub(r'[\(\[\{].*?[\)\]\}]', '', s)
    # Strip suffixes like " - 2004 Remaster", " - Live", " - Radio Edit", etc.
    s = re.sub(r'-\s*(remaster(ed)?(\s*\d+)?|live.*?|radio edit|deluxe.*?|anniversary.*?|mono|stereo|bonus.*?)(\s*-\s*.*)?$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'-\s*\d{4}\s*remaster.*$', '', s, flags=re.IGNORECASE)
    # Normalize accents/diacritics
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    # Strip non-alphanumeric
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def normalize_artist_name(artist: str) -> str:
    """Canonical artist normalization to match primary artists across featured tracks."""
    if not artist:
        return ""
    s = artist.strip().lower()
    # Take primary artist if multiple
    s = re.split(r',|\bfeat\.?\b|\bft\.?\b|\bvs\.?\b|&', s, flags=re.IGNORECASE)[0]
    s = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def get_track_identity_key(title: str, artist: str) -> Tuple[str, str]:
    """Returns canonical (normalized_title, normalized_artist) tuple."""
    return (normalize_song_title(title), normalize_artist_name(artist))

def normalize_text(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()

def is_live_track(title: str, album: str = "") -> bool:
    pattern = r'\b(live|en vivo|live at|live from|live in|live session|unplugged|in concert)\b'
    return bool(re.search(pattern, f"{title} {album}", re.IGNORECASE))

def is_remix_track(title: str, album: str = "") -> bool:
    pattern = r'\b(remix|rmx|club mix|extended mix|dub mix|radio edit|vip mix|vip edit|vip|mashup|rework)\b'
    return bool(re.search(pattern, f"{title} {album}", re.IGNORECASE))

def get_track_release_year(track_item: Dict[str, Any]) -> Optional[int]:
    raw_date = track_item.get("album_release_date") or track_item.get("release_date") or ""
    if raw_date and len(raw_date) >= 4:
        try:
            return int(raw_date[:4])
        except Exception:
            pass
    return None

def extract_track_clean_dict(t: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not t or not isinstance(t, dict) or not t.get("id"):
        return None
    artists_str = ", ".join([a["name"] for a in t.get("artists", []) if isinstance(a, dict) and a.get("name")])
    images = (t.get("album", {}) or {}).get("images", [])
    art_url = images[-1]["url"] if images else (images[0]["url"] if images else "")
    release_date = (t.get("album", {}) or {}).get("release_date", "")
    
    return {
        "id": t["id"],
        "uri": t.get("uri", f"spotify:track:{t['id']}"),
        "title": t.get("name", "Unknown Title"),
        "artist": artists_str or "Unknown Artist",
        "album": (t.get("album", {}) or {}).get("name", "Unknown Album"),
        "album_art_url": art_url,
        "duration_ms": t.get("duration_ms", 0) or 0,
        "album_release_date": release_date,
        "popularity": t.get("popularity", 0) or 0,
        "tags": []
    }

def clean_seed_genre(val: str) -> Optional[str]:
    """Converts user-entered genre name or category into a valid Spotify seed genre."""
    if not val:
        return None
    val_clean = val.strip().lower()
    for g in GENRE_CATALOG:
        if g["id"] == val_clean:
            return g["id"]
    for g in GENRE_CATALOG:
        if g["name"].lower() == val_clean or g["category"].lower() == val_clean:
            return g["id"]
    mapping = {
        "rock & indie": "rock",
        "rock/indie": "rock",
        "electronic & dance": "dance",
        "electronic": "electronic",
        "hip-hop & r&b": "hip-hop",
        "hip-hop": "hip-hop",
        "latin & world": "latino",
        "latin": "latino",
        "chill & acoustic": "chill",
        "chill": "chill",
        "metal & hard": "metal",
        "metal": "metal",
        "jazz & classical": "jazz",
        "jazz": "jazz",
        "country & folk": "country",
        "country": "country",
        "party & upbeat": "party",
        "party": "party",
        "popular": "pop"
    }
    if val_clean in mapping:
        return mapping[val_clean]
    
    slug = re.sub(r'[^a-z0-9\-]', '', val_clean.replace(" ", "-"))
    return slug or None

def discover_boolean_matrix(
    artists: List[Dict[str, str]],
    tracks: List[Dict[str, str]],
    genres: List[Dict[str, str]],
    decades: List[Dict[str, str]],
    keywords: List[Dict[str, str]],
    use_active_vibe: bool = False,
    active_vibe_seeds: Optional[Dict[str, Any]] = None,
    not_liked_songs: bool = True,
    not_in_playlists: bool = True,
    not_recently_played_days: Optional[int] = 30,
    not_live: bool = False,
    not_remix: bool = False,
    low_popularity_only: bool = False,
    hidden_gem_target: str = "artist",
    target_count: int = 30,
    true_shuffle: bool = True,
    avoid_consecutive_artists: bool = True,
    liked_ids_set: Optional[Set[str]] = None,
    playlist_ids_set: Optional[Set[str]] = None,
    recent_ids_set: Optional[Set[str]] = None,
    liked_identities_list: Optional[List[Dict[str, Any]]] = None,
    playlist_identities_list: Optional[List[Dict[str, Any]]] = None,
    recent_identities_list: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    sp = get_spotify_client()
    
    # 1. Parse Inclusions (AND) vs Exclusions (NOT)
    pos_artists = [a for a in artists if a.get("modifier", "AND").upper() == "AND"]
    neg_artists = [a for a in artists if a.get("modifier", "AND").upper() == "NOT"]
    
    pos_tracks = [t for t in tracks if t.get("modifier", "AND").upper() == "AND"]
    neg_tracks = [t for t in tracks if t.get("modifier", "AND").upper() == "NOT"]
    
    pos_genres = [g for g in genres if g.get("modifier", "AND").upper() == "AND"]
    neg_genres = [g for g in genres if g.get("modifier", "AND").upper() == "NOT"]
    
    pos_decades = [d for d in decades if d.get("modifier", "AND").upper() == "AND"]
    neg_decades = [d for d in decades if d.get("modifier", "AND").upper() == "NOT"]
    
    pos_keywords = [k for k in keywords if k.get("modifier", "AND").upper() == "AND"]
    neg_keywords = [k for k in keywords if k.get("modifier", "AND").upper() == "NOT"]
    
    # If active playlist vibe is selected, add top vibe artists to positive pools
    vibe_top_artists = []
    if use_active_vibe and active_vibe_seeds:
        vibe_top_artists = active_vibe_seeds.get("top_artists", [])
        for a_name in vibe_top_artists:
            if not any(a["value"].lower() == a_name.lower() for a in pos_artists):
                pos_artists.append({"value": a_name, "modifier": "AND"})

    # 2. Build Strict Track ID and Title+Artist Exclusion Sets
    excluded_track_ids: Set[str] = set()
    excluded_track_keys: Set[Tuple[str, str]] = set()

    if not_liked_songs:
        if liked_ids_set:
            excluded_track_ids.update(liked_ids_set)
        if liked_identities_list:
            for item in liked_identities_list:
                k = get_track_identity_key(item.get("title", ""), item.get("artist", ""))
                if k[0]:
                    excluded_track_keys.add(k)

    if not_in_playlists:
        if playlist_ids_set:
            excluded_track_ids.update(playlist_ids_set)
        if playlist_identities_list:
            for item in playlist_identities_list:
                k = get_track_identity_key(item.get("title", ""), item.get("artist", ""))
                if k[0]:
                    excluded_track_keys.add(k)

    if not_recently_played_days:
        if recent_ids_set:
            excluded_track_ids.update(recent_ids_set)
        if recent_identities_list:
            for item in recent_identities_list:
                k = get_track_identity_key(item.get("title", ""), item.get("artist", ""))
                if k[0]:
                    excluded_track_keys.add(k)

    # Exclude tracks currently in the active queue vibe
    if use_active_vibe and active_vibe_seeds:
        for q_item in active_vibe_seeds.get("active_queue_identities", []):
            k = get_track_identity_key(q_item.get("title", ""), q_item.get("artist", ""))
            if k[0]:
                excluded_track_keys.add(k)
        for s_id in active_vibe_seeds.get("sample_track_ids", []):
            excluded_track_ids.add(s_id)

    # Negative user track seeds
    for nt in neg_tracks:
        if nt.get("id"):
            excluded_track_ids.add(nt["id"])
        if nt.get("value"):
            parts = nt["value"].split(" - ")
            t_title = parts[0]
            t_artist = parts[1] if len(parts) > 1 else ""
            k = get_track_identity_key(t_title, t_artist)
            if k[0]:
                excluded_track_keys.add(k)

    # Fetch recent tracks from Spotify API directly if enabled
    if not_recently_played_days and sp:
        try:
            sp_recent = get_recently_played_spotify(limit=50)
            for r_item in sp_recent:
                excluded_track_ids.add(r_item["id"])
                k = get_track_identity_key(r_item["title"], r_item["artist"])
                if k[0]:
                    excluded_track_keys.add(k)
        except Exception:
            pass

    candidates: List[Dict[str, Any]] = []
    seen_candidate_ids: Set[str] = set()
    
    def add_candidate(t_raw: Dict[str, Any]):
        cleaned = extract_track_clean_dict(t_raw)
        if cleaned and cleaned["id"] not in seen_candidate_ids:
            seen_candidate_ids.add(cleaned["id"])
            candidates.append(cleaned)

    # 3. Multi-Strategy Deep Candidate Harvesting
    related_artists_pool: List[Tuple[str, str]] = []  # (artist_id, artist_name)
    discovered_artist_genres: List[str] = []

    if sp:
        # Strategy A: Artist Deep Harvest & Related Artists Discovery
        for a in pos_artists:
            a_name = a.get("value", "").strip()
            if not a_name:
                continue

            # Check if this artist is ALSO in neg_artists (user wants artists SIMILAR to this artist, but NOT this artist)
            is_also_negative = any(na.get("value", "").strip().lower() == a_name.lower() for na in neg_artists)

            if not is_also_negative:
                # 1. Harvest tracks by this specific artist directly (pages 0, 10, 20, 30, 40)
                for offset in [0, 10, 20, 30, 40]:
                    try:
                        res = sp.search(q=f'artist:"{a_name}"', type="track", limit=10, offset=offset)
                        for t in (res.get("tracks", {}) or {}).get("items", []) or []:
                            add_candidate(t)
                    except Exception:
                        pass

                # 2. General artist keyword query
                for offset in [0, 10, 20]:
                    try:
                        res = sp.search(q=a_name, type="track", limit=10, offset=offset)
                        for t in (res.get("tracks", {}) or {}).get("items", []) or []:
                            add_candidate(t)
                    except Exception:
                        pass

            # 3. Discover Similar & Related Artists via Spotify Catalog (ALWAYS run to find similar artists!)
            try:
                res_art = sp.search(q=a_name, type="artist", limit=8)
                for r_art in (res_art.get("artists", {}) or {}).get("items", []) or []:
                    r_id = r_art.get("id")
                    r_name = r_art.get("name")
                    if r_name and r_name.lower() != a_name.lower() and not any(r[1].lower() == r_name.lower() for r in related_artists_pool):
                        related_artists_pool.append((r_id or "", r_name))
            except Exception as e:
                print(f"Related artists search error: {e}")

        # Strategy B: Harvest Discovered Related Artists (pages 0, 10, 20)
        for _, r_name in related_artists_pool[:6]:
            for offset in [0, 10, 20]:
                try:
                    res = sp.search(q=f'artist:"{r_name}"', type="track", limit=10, offset=offset)
                    for t in (res.get("tracks", {}) or {}).get("items", []) or []:
                        add_candidate(t)
                except Exception:
                    pass

        # Strategy C: Targeted Genre, Decade & Keyword Matrix
        search_queries: List[str] = []
        decade_years = []
        for d in pos_decades:
            d_val = d.get("value", "").lower()
            if d_val in DECADE_MAP:
                decade_years.append(DECADE_MAP[d_val])

        # Track seeds
        for pt in pos_tracks[:3]:
            t_val = pt.get("value", "")
            if t_val:
                search_queries.append(t_val)

        # Genres + decades
        all_query_genres = [g.get("value", "") for g in pos_genres]
        if all_query_genres and decade_years:
            for g_val in all_query_genres[:3]:
                cg = clean_seed_genre(g_val) or g_val
                for y1, y2 in decade_years[:2]:
                    search_queries.append(f'{cg} year:{y1}-{y2}')
        elif all_query_genres:
            for g_val in all_query_genres[:4]:
                cg = clean_seed_genre(g_val) or g_val
                search_queries.append(f'genre:"{cg}"')
                search_queries.append(f'{cg}')

        for k in pos_keywords[:3]:
            search_queries.append(f'"{k["value"]}"')

        if low_popularity_only and all_query_genres:
            for g_val in all_query_genres[:2]:
                if hidden_gem_target in ["artist", "both"]:
                    search_queries.append(f'emerging {g_val}')
                    search_queries.append(f'indie {g_val}')
                    search_queries.append(f'underground {g_val}')
                if hidden_gem_target in ["track", "both"]:
                    search_queries.append(f'lo-fi {g_val}')
                    search_queries.append(f'acoustic {g_val}')

        if not search_queries and not pos_artists:
            search_queries.extend(['genre:pop', 'genre:rock', 'genre:indie', 'genre:latino', 'year:2024-2026', 'top hits'])

        for sq in search_queries[:8]:
            for offset in [0, 10, 20]:
                try:
                    res = sp.search(q=sq, type="track", limit=10, offset=offset)
                    for t in (res.get("tracks", {}) or {}).get("items", []) or []:
                        add_candidate(t)
                except Exception:
                    pass

    # Strategy D: Local Database Candidate Harvesting (Strictly matching positive seeds!)
    if len(candidates) < target_count * 3:
        try:
            try:
                import database as db
            except ImportError:
                from backend import database as db
            local_tracks = db.get_tracks_query()
            if local_tracks:
                loc_pos_artists = [a["value"].strip().lower() for a in pos_artists if a.get("value")]
                loc_pos_keywords = [k["value"].strip().lower() for k in pos_keywords if k.get("value")]
                loc_pos_genres = [g["value"].strip().lower() for g in pos_genres if g.get("value")]
                
                # If specific seeds were requested, ONLY harvest local tracks that actually match
                if loc_pos_artists or loc_pos_keywords or loc_pos_genres:
                    for t_loc in local_tracks:
                        art = t_loc.get("artist", "").lower()
                        tit = t_loc.get("title", "").lower()
                        alb = t_loc.get("album", "").lower()
                        matches = False
                        if loc_pos_artists and any(pa in art for pa in loc_pos_artists):
                            matches = True
                        if loc_pos_keywords and any(pk in tit or pk in alb for pk in loc_pos_keywords):
                            matches = True
                        if matches:
                            add_candidate({
                                "id": t_loc["id"],
                                "uri": t_loc.get("uri") or f"spotify:track:{t_loc['id']}",
                                "name": t_loc.get("title"),
                                "artists": [{"name": a.strip()} for a in t_loc.get("artist", "").split(",")],
                                "album": {"name": t_loc.get("album"), "images": [{"url": t_loc.get("album_art_url")}], "release_date": t_loc.get("album_release_date", "")},
                                "duration_ms": t_loc.get("duration_ms", 0),
                                "popularity": t_loc.get("popularity", 50)
                            })
                elif not pos_artists and not pos_tracks and not pos_genres and not pos_keywords and not pos_decades and not use_active_vibe:
                    # Only if no positive seeds whatsoever were specified, allow general local pool
                    for t_loc in local_tracks:
                        add_candidate({
                            "id": t_loc["id"],
                            "uri": t_loc.get("uri") or f"spotify:track:{t_loc['id']}",
                            "name": t_loc.get("title"),
                            "artists": [{"name": a.strip()} for a in t_loc.get("artist", "").split(",")],
                            "album": {"name": t_loc.get("album"), "images": [{"url": t_loc.get("album_art_url")}], "release_date": t_loc.get("album_release_date", "")},
                            "duration_ms": t_loc.get("duration_ms", 0),
                            "popularity": t_loc.get("popularity", 50)
                        })
        except Exception as e:
            print(f"Local candidate fallback error: {e}")

    # 4. Multi-Layer Strict Boolean & Canonical Identity Filtering
    filtered: List[Dict[str, Any]] = []
    seen_track_keys: Set[Tuple[str, str]] = set()

    neg_artist_names = [a["value"].strip().lower() for a in neg_artists if a.get("value")]
    neg_genre_names = [g["value"].strip().lower() for g in neg_genres if g.get("value")]
    neg_decade_ranges = [DECADE_MAP[d["value"].lower()] for d in neg_decades if d.get("value", "").lower() in DECADE_MAP]
    neg_keyword_terms = [k["value"].strip().lower() for k in neg_keywords if k.get("value")]

    for t in candidates:
        t_id = t.get("id", "")
        t_title = t.get("title", "")
        t_artist = t.get("artist", "")
        t_album = t.get("album", "")

        # Strict Track ID exclusion
        if t_id in excluded_track_ids:
            continue

        # Strict Canonical Title + Artist Exclusion (matches same song across any album/remaster)
        track_key = get_track_identity_key(t_title, t_artist)
        if not track_key[0]:
            track_key = (normalize_text(t_title), normalize_text(t_artist))

        if track_key in excluded_track_keys:
            continue

        # Strict In-Batch Deduplication
        if track_key in seen_track_keys:
            continue

        # Negative Artist Filter (strictly excludes any track matching neg_artists)
        if any(na in t_artist.lower() for na in neg_artist_names):
            continue

        # Live track filter
        if not_live and is_live_track(t_title, t_album):
            continue

        # Remix track filter
        if not_remix and is_remix_track(t_title, t_album):
            continue

        # Negative Decade Filter
        rel_year = get_track_release_year(t)
        if rel_year and neg_decade_ranges:
            if any(y1 <= rel_year <= y2 for y1, y2 in neg_decade_ranges):
                continue

        # Negative Keyword Filter
        if any(nk in t_title.lower() or nk in t_album.lower() for nk in neg_keyword_terms):
            continue

        # Low Popularity Only (Hidden Gems / Obscure Artists) Filter
        pop = t.get("popularity")
        if low_popularity_only:
            if hidden_gem_target in ["track", "both"]:
                if pop is not None and pop > 42:
                    continue

        # Add discovery tags
        track_tags = [{"name": "SurpriseMe", "color": "#1DB954"}]
        if low_popularity_only:
            if hidden_gem_target == "artist":
                track_tags.append({"name": "💎 Hidden Gem (Artist)", "color": "#a855f7"})
            elif hidden_gem_target == "track":
                track_tags.append({"name": "💎 Hidden Gem (Song)", "color": "#a855f7"})
            else:
                track_tags.append({"name": "💎 Hidden Gem", "color": "#a855f7"})
        elif pop is not None and 0 < pop <= 42:
            track_tags.append({"name": "💎 Hidden Gem", "color": "#a855f7"})
        elif pos_genres:
            primary_genre = pos_genres[0]["value"].capitalize()
            track_tags.append({"name": primary_genre, "color": "#3b82f6"})
        t["tags"] = track_tags

        seen_track_keys.add(track_key)
        filtered.append(t)

    # 5. Diversity Enforcement & Per-Artist Capping
    # Prevents one artist from monopolizing the discovery mix (e.g. max 2-3 tracks per artist)
    max_per_artist = max(2, min(4, target_count // 12))
    diverse_selection: List[Dict[str, Any]] = []
    artist_counts: Dict[str, int] = {}
    overflow_tracks: List[Dict[str, Any]] = []

    for t in filtered:
        norm_art = normalize_artist_name(t.get("artist", ""))
        cnt = artist_counts.get(norm_art, 0)
        if cnt < max_per_artist:
            artist_counts[norm_art] = cnt + 1
            diverse_selection.append(t)
        else:
            overflow_tracks.append(t)

    # If diverse selection is below target_count, fill up with overflow tracks
    if len(diverse_selection) < target_count:
        for t in overflow_tracks:
            if len(diverse_selection) >= target_count:
                break
            diverse_selection.append(t)

    final_pool = diverse_selection if diverse_selection else filtered

    # 6. Queue Population & True Shuffle (Anti-Clumping Fisher-Yates)
    if true_shuffle and final_pool:
        rng = random.SystemRandom()
        n = len(final_pool)
        for i in range(n - 1, 0, -1):
            j = rng.randint(0, i)
            final_pool[i], final_pool[j] = final_pool[j], final_pool[i]

        if avoid_consecutive_artists and len(final_pool) > 2:
            for i in range(len(final_pool) - 1):
                art1 = normalize_artist_name(final_pool[i].get("artist", ""))
                art2 = normalize_artist_name(final_pool[i + 1].get("artist", ""))
                if art1 and art2 and art1 == art2:
                    for k in range(i + 2, min(len(final_pool), i + 12)):
                        if normalize_artist_name(final_pool[k].get("artist", "")) != art1:
                            final_pool[i + 1], final_pool[k] = final_pool[k], final_pool[i + 1]
                            break

    final_queue = final_pool[:target_count]

    return {
        "success": True,
        "tracks": final_queue,
        "total_discovered": len(final_queue),
        "target_count": target_count,
        "candidates_evaluated": len(candidates),
        "excluded_count": len(candidates) - len(final_queue)
    }


