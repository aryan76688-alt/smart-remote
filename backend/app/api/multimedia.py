import os
import shutil
import subprocess
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/media", tags=["multimedia"])

class MediaActionRequest(BaseModel):
    action: str  # play, pause, play_pause, next, prev, vol_up, vol_down, mute, unmute

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    rate: Optional[int] = 0  # -100 to 100
    pitch: Optional[int] = 0 # -100 to 100

class SoundboardRequest(BaseModel):
    sound: str  # bell, alert, warning, camera, ping, siren, airhorn

@router.get("/player")
def get_player_status():
    """
    Get current media player info and volume level.
    """
    title = "No media detected"
    artist = ""
    album = ""
    status = "Stopped"
    player_name = ""

    # Check playerctl first if present
    if shutil.which("playerctl"):
        try:
            status_res = subprocess.run(["playerctl", "status"], capture_output=True, text=True, timeout=1.5)
            if status_res.returncode == 0 and status_res.stdout.strip():
                status = status_res.stdout.strip()
                pname = subprocess.run(["playerctl", "-l"], capture_output=True, text=True, timeout=1)
                player_name = pname.stdout.strip().splitlines()[0] if pname.stdout.strip() else "Player"
                title_res = subprocess.run(["playerctl", "metadata", "title"], capture_output=True, text=True, timeout=1)
                if title_res.stdout.strip():
                    title = title_res.stdout.strip()
                artist_res = subprocess.run(["playerctl", "metadata", "artist"], capture_output=True, text=True, timeout=1)
                if artist_res.stdout.strip():
                    artist = artist_res.stdout.strip()
                album_res = subprocess.run(["playerctl", "metadata", "album"], capture_output=True, text=True, timeout=1)
                if album_res.stdout.strip():
                    album = album_res.stdout.strip()
        except Exception:
            pass

    # Read system volume via amixer
    volume = 50
    muted = False
    try:
        amixer_res = subprocess.run(["amixer", "get", "Master"], capture_output=True, text=True, timeout=1.5)
        out = amixer_res.stdout
        if "[" in out and "%]" in out:
            import re
            m = re.search(r"\[(\d+)%\]", out)
            if m:
                volume = int(m.group(1))
            if "[off]" in out:
                muted = True
    except Exception:
        pass

    return {
        "status": status,
        "title": title,
        "artist": artist,
        "album": album,
        "player": player_name,
        "volume": volume,
        "muted": muted
    }

@router.post("/action")
def control_media(req: MediaActionRequest):
    """
    Trigger media action (universal MPRIS, XF86 keys, or ALSA amixer).
    """
    action = req.action.lower()
    has_playerctl = bool(shutil.which("playerctl"))
    env = os.environ.copy()
    env["DISPLAY"] = ":0"

    try:
        if action in ["play", "pause", "play_pause"]:
            if has_playerctl:
                cmd = "play-pause" if action == "play_pause" else action
                res = subprocess.run(["playerctl", cmd], capture_output=True, text=True, timeout=2)
                if res.returncode == 0:
                    return {"success": True, "action": action}
            # Fallback to XF86AudioPlay via xdotool
            subprocess.run(["xdotool", "key", "XF86AudioPlay"], env=env, timeout=2)
            return {"success": True, "action": action, "fallback": "xdotool"}

        elif action == "next":
            if has_playerctl:
                res = subprocess.run(["playerctl", "next"], capture_output=True, text=True, timeout=2)
                if res.returncode == 0:
                    return {"success": True, "action": "next"}
            subprocess.run(["xdotool", "key", "XF86AudioNext"], env=env, timeout=2)
            return {"success": True, "action": "next", "fallback": "xdotool"}

        elif action == "prev" or action == "previous":
            if has_playerctl:
                res = subprocess.run(["playerctl", "previous"], capture_output=True, text=True, timeout=2)
                if res.returncode == 0:
                    return {"success": True, "action": "previous"}
            subprocess.run(["xdotool", "key", "XF86AudioPrev"], env=env, timeout=2)
            return {"success": True, "action": "previous", "fallback": "xdotool"}

        elif action == "vol_up":
            subprocess.run(["amixer", "set", "Master", "5%+"], timeout=2)
            return {"success": True, "action": "vol_up"}

        elif action == "vol_down":
            subprocess.run(["amixer", "set", "Master", "5%-"], timeout=2)
            return {"success": True, "action": "vol_down"}

        elif action == "mute":
            subprocess.run(["amixer", "set", "Master", "mute"], timeout=2)
            return {"success": True, "action": "mute"}

        elif action == "unmute":
            subprocess.run(["amixer", "set", "Master", "unmute"], timeout=2)
            return {"success": True, "action": "unmute"}

        elif action.startswith("vol:"):
            # Set exact volume percentage e.g. vol:75
            val = int(action.split(":")[1])
            val = max(0, min(100, val))
            subprocess.run(["amixer", "set", "Master", f"{val}%"], timeout=2)
            return {"success": True, "action": f"vol:{val}"}

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported media action: {action}")

    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/tts")
def speak_tts(req: TTSRequest, background_tasks: BackgroundTasks):
    """
    Speak text out loud on laptop speakers via spd-say.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Text is too long (max 1000 chars)")

    cmd = ["spd-say"]
    if req.rate != 0:
        cmd.extend(["-r", str(req.rate)])
    if req.pitch != 0:
        cmd.extend(["-p", str(req.pitch)])
    cmd.append(text)

    def _run_tts():
        try:
            subprocess.run(cmd, timeout=10)
        except Exception:
            pass

    background_tasks.add_task(_run_tts)
    return {"success": True, "message": f"Speaking: '{text[:50]}...'"}

@router.post("/soundboard")
def play_sound(req: SoundboardRequest, background_tasks: BackgroundTasks):
    """
    Play soundboard effects directly on laptop speakers.
    """
    sound_map = {
        "bell": "/usr/share/sounds/freedesktop/stereo/bell.oga",
        "alert": "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga",
        "warning": "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga",
        "info": "/usr/share/sounds/freedesktop/stereo/dialog-information.oga",
        "camera": "/usr/share/sounds/freedesktop/stereo/camera-shutter.oga",
        "ping": "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga",
        "trash": "/usr/share/sounds/freedesktop/stereo/trash-empty.oga"
    }

    sound_name = req.sound.lower()
    sound_file = sound_map.get(sound_name)

    def _play():
        if sound_file and os.path.exists(sound_file):
            if shutil.which("pw-play"):
                subprocess.run(["pw-play", sound_file], timeout=5)
            elif shutil.which("ffplay"):
                subprocess.run(["ffplay", "-nodisp", "-autoexit", sound_file], timeout=5)
        elif sound_name in ["siren", "airhorn"]:
            synth_freq = "800" if sound_name == "siren" else "440"
            if shutil.which("ffplay"):
                subprocess.run([
                    "ffplay", "-nodisp", "-autoexit",
                    "-f", "lavfi",
                    f"sine=frequency={synth_freq}:duration=0.8"
                ], timeout=3)

    background_tasks.add_task(_play)
    return {"success": True, "sound": sound_name}

@router.get("/audio/stream")
async def stream_laptop_audio():
    """
    Real-time laptop audio stream to mobile headphones over HTTP chunked MP3.
    """
    cmd = [
        "ffmpeg",
        "-f", "alsa",
        "-i", "hw:0,0",
        "-ac", "2",
        "-ar", "22050",
        "-b:a", "64k",
        "-f", "mp3",
        "pipe:1"
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL
        )

        async def audio_generator():
            try:
                while True:
                    chunk = await proc.stdout.read(4096)
                    if not chunk:
                        break
                    yield chunk
            finally:
                if proc.returncode is None:
                    try:
                        proc.terminate()
                        await proc.wait()
                    except Exception:
                        pass

        return StreamingResponse(
            audio_generator(),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio stream failed: {e}")
