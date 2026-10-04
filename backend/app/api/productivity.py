import os
import shutil
import psutil
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/productivity", tags=["productivity"])

# ──────────────────────────────────────────────────────────────────────────
# CLIPBOARD SYNC
# ──────────────────────────────────────────────────────────────────────────
class ClipboardPayload(BaseModel):
    text: str

@router.get("/clipboard")
def get_laptop_clipboard():
    """Reads current clipboard text from the Kali Linux desktop using xclip."""
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    if "XAUTHORITY" not in env:
        xauth = os.path.expanduser("~/.Xauthority")
        if os.path.exists(xauth):
            env["XAUTHORITY"] = xauth

    try:
        res = subprocess.run(
            ["xclip", "-selection", "clipboard", "-o"],
            env=env,
            capture_output=True,
            text=True,
            timeout=2.0
        )
        if res.returncode == 0:
            return {"success": True, "text": res.stdout, "length": len(res.stdout)}
        else:
            return {"success": True, "text": "", "length": 0}
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}

@router.post("/clipboard")
def set_laptop_clipboard(payload: ClipboardPayload):
    """Pushes text from mobile clipboard directly into the Kali Linux desktop clipboard."""
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    if "XAUTHORITY" not in env:
        xauth = os.path.expanduser("~/.Xauthority")
        if os.path.exists(xauth):
            env["XAUTHORITY"] = xauth

    try:
        proc = subprocess.Popen(
            ["xclip", "-selection", "clipboard"],
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        proc.communicate(input=payload.text.encode("utf-8"), timeout=2.0)
        return {"success": True, "message": "Copied to Kali Linux clipboard!", "length": len(payload.text)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set clipboard: {e}")

# ──────────────────────────────────────────────────────────────────────────
# AIRDROP-STYLE QUICK DROP
# ──────────────────────────────────────────────────────────────────────────
@router.post("/quick-drop")
async def quick_drop_file(file: UploadFile = File(...)):
    """Receives photos/files from phone and saves directly into ~/Downloads with an alert chime."""
    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)

    dest_file = downloads_dir / file.filename
    try:
        with open(dest_file, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Gentle audio notification chime on laptop
        try:
            chime = "ffplay -nodisp -autoexit -loglevel quiet -f lavfi -i 'sine=frequency=784:duration=0.1,sine=frequency=1046:duration=0.18' 2>/dev/null &"
            subprocess.Popen(chime, shell=True)
        except Exception:
            pass

        return {
            "success": True,
            "filename": file.filename,
            "saved_path": str(dest_file),
            "size_bytes": dest_file.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quick Drop failed: {e}")

# ──────────────────────────────────────────────────────────────────────────
# REMOTE APP LAUNCHER
# ──────────────────────────────────────────────────────────────────────────
REGISTERED_APPS = [
    {"id": "chromium", "name": "Chromium Browser", "icon": "Globe", "bin": "chromium", "proc_match": "chromium"},
    {"id": "firefox", "name": "Firefox Browser", "icon": "Compass", "bin": "firefox-esr", "proc_match": "firefox"},
    {"id": "terminal", "name": "Terminal", "icon": "Terminal", "bin": "qterminal", "proc_match": "qterminal"},
    {"id": "code", "name": "VS Code", "icon": "Code", "bin": "code", "proc_match": "code"},
    {"id": "files", "name": "File Manager", "icon": "Folder", "bin": "thunar", "proc_match": "thunar"},
    {"id": "calc", "name": "Calculator", "icon": "Calculator", "bin": "galculator", "proc_match": "galculator"},
    {"id": "text", "name": "Mousepad Editor", "icon": "FileText", "bin": "mousepad", "proc_match": "mousepad"}
]

@router.get("/apps")
def list_apps():
    """Lists registered desktop applications and their live running status."""
    running_names = set()
    try:
        for p in psutil.process_iter(['name']):
            n = (p.info.get('name') or '').lower()
            if n:
                running_names.add(n)
    except Exception:
        pass

    results = []
    for app in REGISTERED_APPS:
        bin_path = shutil.which(app["bin"]) or shutil.which(app["id"])
        is_installed = bool(bin_path)
        is_running = any(app["proc_match"] in rn for rn in running_names)
        results.append({
            "id": app["id"],
            "name": app["name"],
            "icon": app["icon"],
            "installed": is_installed,
            "running": is_running
        })
    return {"apps": results}

class AppActionPayload(BaseModel):
    app_id: str

@router.post("/apps/launch")
def launch_app(payload: AppActionPayload):
    """Spawns an application on the Kali Linux X11 display."""
    target = next((a for a in REGISTERED_APPS if a["id"] == payload.app_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="App not found")

    bin_path = shutil.which(target["bin"]) or shutil.which(target["id"])
    if not bin_path:
        raise HTTPException(status_code=400, detail=f"{target['name']} is not installed")

    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    if "XAUTHORITY" not in env:
        xauth = os.path.expanduser("~/.Xauthority")
        if os.path.exists(xauth):
            env["XAUTHORITY"] = xauth

    try:
        subprocess.Popen([bin_path], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        return {"success": True, "message": f"Launched {target['name']}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Launch failed: {e}")

@router.post("/apps/kill")
def kill_app(payload: AppActionPayload):
    """Terminates an application process."""
    target = next((a for a in REGISTERED_APPS if a["id"] == payload.app_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="App not found")

    try:
        subprocess.run(["pkill", "-f", target["proc_match"]], check=False)
        return {"success": True, "message": f"Closed {target['name']}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kill failed: {e}")

# ──────────────────────────────────────────────────────────────────────────
# BATTERY & POWER HEALTH
# ──────────────────────────────────────────────────────────────────────────
@router.get("/battery")
def get_battery_health():
    """Reads laptop battery capacity, charging status, and power supply information."""
    bat_path = Path("/sys/class/power_supply/BAT0")
    ac_path = Path("/sys/class/power_supply/AC0")

    percentage = 100
    status = "AC Power"
    is_plugged = True

    if bat_path.exists():
        try:
            cap_file = bat_path / "capacity"
            stat_file = bat_path / "status"
            if cap_file.exists():
                percentage = int(cap_file.read_text().strip())
            if stat_file.exists():
                status = stat_file.read_text().strip()
        except Exception:
            pass

    if ac_path.exists():
        try:
            online_file = ac_path / "online"
            if online_file.exists():
                is_plugged = online_file.read_text().strip() == "1"
        except Exception:
            pass

    # Use psutil fallback
    try:
        bat = psutil.sensors_battery()
        if bat is not None:
            percentage = round(bat.percent)
            is_plugged = bat.power_plugged if bat.power_plugged is not None else is_plugged
            status = "Charging" if is_plugged else "Discharging"
    except Exception:
        pass

    return {
        "percentage": percentage,
        "status": status,
        "is_plugged": is_plugged,
        "overcharge_warning": is_plugged and percentage >= 98,
        "low_battery_warning": not is_plugged and percentage <= 20
    }

# ──────────────────────────────────────────────────────────────────────────
# GEMINI AI BRAIN CONTROLS
# ──────────────────────────────────────────────────────────────────────────
class GeminiKeyPayload(BaseModel):
    api_key: str

@router.get("/gemini/status")
def get_gemini_status():
    return {
        "configured": gemini_service.is_configured(),
        "masked_key": f"...{gemini_service.get_api_key()[-4:]}" if gemini_service.is_configured() else None
    }

@router.post("/gemini/key")
def update_gemini_key(payload: GeminiKeyPayload):
    gemini_service.set_api_key(payload.api_key)
    return {"success": True, "configured": gemini_service.is_configured()}

class JarvisChatPayload(BaseModel):
    prompt: str
    context: Optional[Dict[str, Any]] = None

@router.post("/gemini/ask")
def ask_jarvis_ai(payload: JarvisChatPayload):
    return gemini_service.ask_jarvis(payload.prompt, payload.context)
