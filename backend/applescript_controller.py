import subprocess
import sys
import json
from typing import Optional, Dict, Any

def run_applescript(script: str) -> Optional[str]:
    """Execute an AppleScript command using osascript on macOS."""
    if sys.platform != "darwin":
        return None
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return None
    except Exception:
        return None

def is_spotify_running() -> bool:
    """Check if Spotify Desktop is currently running on macOS."""
    script = 'tell application "System Events" to (name of processes) contains "Spotify"'
    res = run_applescript(script)
    return res == "true"

def launch_spotify() -> bool:
    """Launch Spotify Desktop on macOS in the background without stealing focus."""
    try:
        subprocess.run(["open", "-g", "-j", "-a", "/Applications/Spotify.app"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def play_track(track_uri: str) -> bool:
    """Tell Spotify Desktop to play a specific track URI without stealing focus."""
    script = f'''
    tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
    end tell
    tell application "Spotify"
        play track "{track_uri}"
    end tell
    try
        tell application frontApp to activate
    end try
    '''
    return run_applescript(script) is not None

def playpause() -> bool:
    script = 'tell application "Spotify" to playpause'
    return run_applescript(script) is not None

def pause() -> bool:
    script = 'tell application "Spotify" to pause'
    return run_applescript(script) is not None

def resume() -> bool:
    script = 'tell application "Spotify" to play'
    return run_applescript(script) is not None

def next_track() -> bool:
    script = 'tell application "Spotify" to next track'
    return run_applescript(script) is not None

def previous_track() -> bool:
    script = 'tell application "Spotify" to previous track'
    return run_applescript(script) is not None

def set_volume(volume_percent: int) -> bool:
    vol = max(0, min(100, int(volume_percent)))
    script = f'tell application "Spotify" to set sound volume to {vol}'
    return run_applescript(script) is not None

def set_position(position_seconds: float) -> bool:
    pos = max(0.0, float(position_seconds))
    script = f'tell application "Spotify" to set player position to {pos}'
    return run_applescript(script) is not None

def get_current_status() -> Optional[Dict[str, Any]]:
    """Fetch real-time playback state from macOS Spotify Desktop."""
    if not is_spotify_running():
        return None

    script = '''
    tell application "Spotify"
        if player state is stopped then
            return "stopped|||0|||100||||||||||||0"
        end if
        set pState to player state as text
        set pPos to player position as text
        set pVol to sound volume as text
        set tName to name of current track
        set tArtist to artist of current track
        set tAlbum to album of current track
        set tId to id of current track
        set tDur to duration of current track as text
        return pState & "|||" & pPos & "|||" & pVol & "|||" & tName & "|||" & tArtist & "|||" & tAlbum & "|||" & tId & "|||" & tDur
    end tell
    '''
    res = run_applescript(script)
    if not res:
        return None
    try:
        parts = res.split("|||")
        if len(parts) < 8:
            return None
        p_state, p_pos, p_vol, t_name, t_artist, t_album, t_id, t_dur = parts[:8]
        
        is_playing = (p_state.lower() == "playing")
        track_id = t_id.replace("spotify:track:", "")
        dur_raw = float(t_dur) if t_dur else 0
        duration_ms = int(dur_raw) if dur_raw > 1000 else int(dur_raw * 1000)
        pos_raw = float(p_pos) if p_pos else 0
        progress_ms = int(pos_raw * 1000)
        volume = int(p_vol) if p_vol else 50
        
        return {
            "is_playing": is_playing,
            "progress_ms": progress_ms,
            "duration_ms": duration_ms,
            "device": {"name": "Mac Spotify Desktop", "type": "Computer", "volume_percent": volume},
            "item": {
                "id": track_id,
                "uri": t_id,
                "title": t_name,
                "artist": t_artist,
                "album": t_album,
                "album_art_url": "",
                "duration_ms": duration_ms
            },
            "engine": "applescript"
        }
    except Exception:
        return None
