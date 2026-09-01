import sqlite3
import os
from typing import List, Dict, Any, Optional, Tuple

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
DB_PATH = os.getenv("DATABASE_PATH", os.path.join(DATA_DIR, "spotify_tags.db"))

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tracks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        uri TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        album_art_url TEXT,
        duration_ms INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Playlists table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        total_tracks INTEGER DEFAULT 0,
        is_custom INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Playlist-Tracks table (maintains persistent custom user order)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id, order_index)
    );
    """)
    
    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)
    
    # Playback History table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playback_history (
        track_id TEXT NOT NULL,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (track_id, played_at)
    );
    """)
    
    conn.commit()
    conn.close()

# --- Tracks Management ---

def upsert_tracks(tracks: List[Dict[str, Any]]):
    if not tracks:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    INSERT OR REPLACE INTO tracks (id, uri, title, artist, album, album_art_url, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """
    
    data = [
        (
            t["id"],
            t.get("uri", f"spotify:track:{t['id']}"),
            t.get("title", "Unknown Title"),
            t.get("artist", "Unknown Artist"),
            t.get("album", "Unknown Album"),
            t.get("album_art_url", ""),
            int(t.get("duration_ms", 0) or 0)
        )
        for t in tracks
        if t and t.get("id")
    ]
    
    cursor.executemany(query, data)
    conn.commit()
    conn.close()

def upsert_playlists(playlists: List[Dict[str, Any]]):
    if not playlists:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    INSERT OR REPLACE INTO playlists (id, name, description, image_url, total_tracks, is_custom)
    VALUES (?, ?, ?, ?, ?, ?);
    """
    
    data = [
        (
            p["id"],
            p.get("name", "Untitled Playlist"),
            p.get("description", ""),
            p.get("image_url", ""),
            int(p.get("total_tracks", 0) or 0),
            int(p.get("is_custom", 0) or 0)
        )
        for p in playlists
        if p and p.get("id")
    ]
    
    cursor.executemany(query, data)
    conn.commit()
    conn.close()

def set_playlist_tracks(playlist_id: str, track_ids: List[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?;", (playlist_id,))
    
    data = [
        (playlist_id, track_id, idx)
        for idx, track_id in enumerate(track_ids)
        if track_id
    ]
    cursor.executemany("""
    INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, order_index)
    VALUES (?, ?, ?);
    """, data)
    
    cursor.execute("UPDATE playlists SET total_tracks = ? WHERE id = ?;", (len(data), playlist_id))
    
    conn.commit()
    conn.close()

def add_track_to_playlist(playlist_id: str, track_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(order_index) FROM playlist_tracks WHERE playlist_id = ?;", (playlist_id,))
    row = cursor.fetchone()
    max_idx = (row[0] + 1) if row and row[0] is not None else 0
    cursor.execute("""
    INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, order_index)
    VALUES (?, ?, ?);
    """, (playlist_id, track_id, max_idx))
    cursor.execute("UPDATE playlists SET total_tracks = total_tracks + 1 WHERE id = ?;", (playlist_id,))
    conn.commit()
    conn.close()

def reorder_playlist_tracks(playlist_id: str, ordered_track_ids: List[str]):
    set_playlist_tracks(playlist_id, ordered_track_ids)

def rename_playlist(playlist_id: str, new_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE playlists SET name = ? WHERE id = ?;", (new_name.strip(), playlist_id))
    conn.commit()
    conn.close()

def delete_playlist(playlist_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlists WHERE id = ?;", (playlist_id,))
    cursor.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?;", (playlist_id,))
    conn.commit()
    conn.close()

def clear_all_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_tracks;")
    cursor.execute("DELETE FROM tracks;")
    cursor.execute("DELETE FROM playlists;")
    cursor.execute("DELETE FROM playback_history;")
    conn.commit()
    conn.close()

def get_total_track_count() -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM tracks;")
    row = cursor.fetchone()
    count = row[0] if row else 0
    conn.close()
    return count

# --- Query & Filter Tracks ---

def get_tracks_query(
    playlist_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "order_index",
    sort_direction: str = "asc"
) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    select_clause = """
    SELECT t.id, t.uri, t.title, t.artist, t.album, t.album_art_url, t.duration_ms,
           COALESCE(pt.order_index, 0) as order_index
    FROM tracks t
    """
    
    if playlist_id:
        join_clause = "JOIN playlist_tracks pt ON t.id = pt.track_id AND pt.playlist_id = ?"
        params = [playlist_id]
    else:
        join_clause = "LEFT JOIN playlist_tracks pt ON t.id = pt.track_id"
        params = []
        
    where_conditions = []
    
    if search and search.strip():
        term = f"%{search.strip()}%"
        where_conditions.append("(t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ?)")
        params.extend([term, term, term])
        
    where_clause = ""
    if where_conditions:
        where_clause = "WHERE " + " AND ".join(where_conditions)
        
    group_clause = "GROUP BY t.id"
    
    valid_sorts = {"order_index": "order_index", "title": "t.title", "artist": "t.artist", "album": "t.album", "duration_ms": "t.duration_ms"}
    sort_column = valid_sorts.get(sort_by, "order_index")
    direction = "DESC" if sort_direction.lower() == "desc" else "ASC"
    order_clause = f"ORDER BY {sort_column} {direction}, t.id ASC"
    
    query = f"""
    {select_clause}
    {join_clause}
    {where_clause}
    {group_clause}
    {order_clause};
    """
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]

def get_duplicates() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT t.id, t.uri, t.title, t.artist, t.album, t.album_art_url, t.duration_ms
    FROM tracks t
    WHERE LOWER(t.title) IN (
        SELECT LOWER(title) FROM tracks GROUP BY LOWER(title), LOWER(artist) HAVING COUNT(*) > 1
    )
    ORDER BY t.artist, t.title;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_playlists() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists ORDER BY is_custom DESC, name ASC;")
    playlists = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT playlist_id, track_id FROM playlist_tracks ORDER BY playlist_id, order_index ASC;")
    rows = cursor.fetchall()
    conn.close()
    
    mapping = {}
    for r in rows:
        pid = r["playlist_id"]
        if pid not in mapping:
            mapping[pid] = []
        mapping[pid].append(r["track_id"])
        
    for p in playlists:
        p["track_ids"] = mapping.get(p["id"], [])
        
    return playlists

# --- Playback History & Discovery Query Helpers ---

def record_playback(track_id: str):
    if not track_id:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO playback_history (track_id, played_at)
    VALUES (?, CURRENT_TIMESTAMP);
    """, (track_id,))
    conn.commit()
    conn.close()

def get_recently_played_ids(days: int = 7) -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT DISTINCT track_id FROM playback_history
    WHERE played_at >= datetime('now', '-' || ? || ' days');
    """, (days,))
    rows = cursor.fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]

def get_recently_played_identities(days: int = 7) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT DISTINCT t.id, t.title, t.artist FROM playback_history ph
    JOIN tracks t ON ph.track_id = t.id
    WHERE ph.played_at >= datetime('now', '-' || ? || ' days');
    """, (days,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_user_saved_track_ids() -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT DISTINCT track_id FROM playlist_tracks
    WHERE playlist_id = 'liked_songs';
    """)
    rows = cursor.fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]

def get_all_user_saved_track_identities() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT DISTINCT t.id, t.title, t.artist FROM tracks t
    JOIN playlist_tracks pt ON t.id = pt.track_id
    WHERE pt.playlist_id = 'liked_songs';
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_playlist_track_ids() -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT track_id FROM playlist_tracks;")
    rows = cursor.fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]

def get_all_playlist_track_identities() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT t.id, t.title, t.artist FROM tracks t JOIN playlist_tracks pt ON t.id = pt.track_id;")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_active_playlist_vibe_seeds(playlist_id: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if playlist_id:
        cursor.execute("""
        SELECT t.id, t.artist, t.title, t.album
        FROM tracks t
        JOIN playlist_tracks pt ON t.id = pt.track_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.order_index ASC
        LIMIT 50;
        """, (playlist_id,))
    else:
        cursor.execute("""
        SELECT t.id, t.artist, t.title, t.album
        FROM tracks t
        JOIN playlist_tracks pt ON t.id = pt.track_id
        ORDER BY pt.order_index ASC
        LIMIT 50;
        """)
        
    rows = cursor.fetchall()
    conn.close()
    
    tracks = [dict(r) for r in rows]
    artist_counts: Dict[str, int] = {}
    for t in tracks:
        art = t.get("artist", "")
        for single_art in art.split(","):
            clean_art = single_art.strip()
            if clean_art:
                artist_counts[clean_art] = artist_counts.get(clean_art, 0) + 1
                
    top_artists = sorted(artist_counts.keys(), key=lambda a: artist_counts[a], reverse=True)[:5]
    sample_tracks = [{"id": t["id"], "title": t.get("title", ""), "artist": t.get("artist", "")} for t in tracks[:10]]
    active_queue_identities = [{"title": t.get("title", ""), "artist": t.get("artist", "")} for t in tracks]
    
    return {
        "top_artists": top_artists,
        "sample_tracks": sample_tracks,
        "sample_track_ids": [t["id"] for t in tracks[:10]],
        "active_queue_identities": active_queue_identities,
        "total_analyzed": len(tracks)
    }

