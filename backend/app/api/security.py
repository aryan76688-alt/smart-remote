import glob
import os
import shutil
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/security", tags=["security"])

class StealthRequest(BaseModel):
    enabled: bool

class PanicRequest(BaseModel):
    lock_screen: bool = True
    mute_audio: bool = True
    blank_screen: bool = True
    minimize_windows: bool = True

@router.get("/tamper")
def get_tamper_status():
    """
    Inspects hardware tamper signals:
    - AC power unplugged
    - Laptop lid closed/opened
    - Battery percentage and charging status
    """
    ac_online = True
    ac_found = False
    for path in glob.glob("/sys/class/power_supply/AC*"):
        ac_online_file = os.path.join(path, "online")
        if os.path.exists(ac_online_file):
            try:
                with open(ac_online_file, "r") as f:
                    val = f.read().strip()
                    ac_online = (val == "1")
                    ac_found = True
                    break
            except Exception:
                pass

    lid_state = "unknown"
    for path in glob.glob("/proc/acpi/button/lid/*/state"):
        try:
            with open(path, "r") as f:
                content = f.read().lower()
                if "closed" in content:
                    lid_state = "closed"
                elif "open" in content:
                    lid_state = "open"
                break
        except Exception:
            pass

    battery_level = 100
    battery_status = "Full"
    for path in glob.glob("/sys/class/power_supply/BAT*"):
        cap_file = os.path.join(path, "capacity")
        stat_file = os.path.join(path, "status")
        try:
            if os.path.exists(cap_file):
                with open(cap_file, "r") as f:
                    battery_level = int(f.read().strip())
            if os.path.exists(stat_file):
                with open(stat_file, "r") as f:
                    battery_status = f.read().strip()
            break
        except Exception:
            pass

    is_tampered = (ac_found and not ac_online) or (lid_state == "closed")

    return {
        "tampered": is_tampered,
        "ac_power_online": ac_online,
        "lid_state": lid_state,
        "battery_level": battery_level,
        "battery_status": battery_status,
        "alert": "Charger disconnected or lid moved!" if is_tampered else "Normal"
    }

@router.post("/stealth")
def toggle_stealth(req: StealthRequest):
    """
    Ghost screen blackout: turns host laptop monitor off/on using DPMS
    while keeping Kali and remote screen capture active.
    """
    env = os.environ.copy()
    env["DISPLAY"] = ":0"

    try:
        if req.enabled:
            # Enable DPMS and force display off
            subprocess.run(["xset", "+dpms"], env=env, timeout=2)
            subprocess.run(["xset", "dpms", "force", "off"], env=env, timeout=2)
            return {"success": True, "stealth": True, "message": "Host display blanked (Ghost Mode)"}
        else:
            # Wake display
            subprocess.run(["xset", "dpms", "force", "on"], env=env, timeout=2)
            return {"success": True, "stealth": False, "message": "Host display restored"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/panic")
def trigger_panic(req: PanicRequest):
    """
    Emergency Panic Killswitch:
    - Mutes audio instantly
    - Minimizes all active windows
    - Locks X11 desktop session
    - Powers off display
    """
    env = os.environ.copy()
    env["DISPLAY"] = ":0"
    results = {}

    if req.mute_audio:
        try:
            subprocess.run(["amixer", "set", "Master", "mute"], timeout=2)
            results["audio_muted"] = True
        except Exception as e:
            results["audio_muted"] = False

    if req.minimize_windows:
        try:
            subprocess.run(["xdotool", "key", "Control_L+Alt_L+d"], env=env, timeout=2)
            results["windows_minimized"] = True
        except Exception:
            try:
                subprocess.run(["xdotool", "key", "super+d"], env=env, timeout=2)
                results["windows_minimized"] = True
            except Exception:
                results["windows_minimized"] = False

    if req.blank_screen:
        try:
            subprocess.run(["xset", "+dpms"], env=env, timeout=2)
            subprocess.run(["xset", "dpms", "force", "off"], env=env, timeout=2)
            results["screen_blanked"] = True
        except Exception:
            results["screen_blanked"] = False

    if req.lock_screen:
        try:
            # Try xflock4, fallback to loginctl lock-session
            if subprocess.run(["xflock4"], env=env, timeout=2).returncode == 0:
                results["screen_locked"] = True
            else:
                subprocess.run(["loginctl", "lock-session"], timeout=2)
                results["screen_locked"] = True
        except Exception:
            results["screen_locked"] = False

    return {
        "success": True,
        "status": "PANIC_EXECUTED",
        "details": results
    }

# ──────────────────────────────────────────────────────────────────────────
# INTRUDER SNAPSHOT TRAP & HONEYPOT DECOY
# ──────────────────────────────────────────────────────────────────────────
CAPTURES_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "captures"
CAPTURES_DIR.mkdir(parents=True, exist_ok=True)

intruder_trap_state: Dict[str, Any] = {
    "armed": False,
    "honeypot": True,
    "trigger_mode": "all",  # "tamper", "input", "all"
    "armed_at": None,
    "last_triggered": None,
    "events": []
}

_decoy_proc: Optional[subprocess.Popen] = None
_intruder_thread: Optional[threading.Thread] = None
_stop_intruder_event = threading.Event()

def launch_decoy_screen(server_base: str = "http://localhost:7070"):
    global _decoy_proc
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    if "XAUTHORITY" not in env:
        xauth = os.path.expanduser("~/.Xauthority")
        if os.path.exists(xauth):
            env["XAUTHORITY"] = xauth

    chromium_bin = shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chromium-browser")
    if not chromium_bin:
        return False

    decoy_url = f"{server_base}/decoy"
    cmd = [
        chromium_bin,
        f"--app={decoy_url}",
        "--start-fullscreen",
        "--kiosk",
        "--no-first-run",
        "--disable-infobars",
        "--user-data-dir=/tmp/smart_remote_decoy_profile"
    ]
    try:
        if _decoy_proc and _decoy_proc.poll() is None:
            return True
        _decoy_proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        print(f"[DECOY] Failed to launch: {e}")
        return False

def close_decoy_screen():
    global _decoy_proc
    if _decoy_proc and _decoy_proc.poll() is None:
        try:
            _decoy_proc.terminate()
            _decoy_proc.wait(timeout=1.0)
        except Exception:
            try:
                _decoy_proc.kill()
            except Exception:
                pass
        _decoy_proc = None
    subprocess.run(["pkill", "-f", "smart_remote_decoy_profile"], check=False)

def trigger_intruder_snapshot(reason: str = "Intruder Motion Detected"):
    ts_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"intruder_{ts_str}.jpg"
    dest_path = CAPTURES_DIR / filename

    captured = False
    try:
        from app.camera.camera_manager import camera_manager
        camera_manager.start_laptop_camera()
        jpeg = camera_manager.read_laptop_jpeg(quality=92)
        camera_manager.stop_laptop_camera()
        if jpeg:
            dest_path.write_bytes(jpeg)
            captured = True
    except Exception as e:
        print(f"[INTRUDER-TRAP] Snapshot error: {e}")

    event = {
        "id": ts_str,
        "timestamp": datetime.now().isoformat(),
        "reason": reason,
        "filename": filename if captured else None,
        "photo_url": f"/api/security/intruder/snapshot/{filename}" if captured else None,
        "captured": captured
    }
    intruder_trap_state["last_triggered"] = datetime.now().isoformat()
    intruder_trap_state["events"].insert(0, event)
    if len(intruder_trap_state["events"]) > 50:
        intruder_trap_state["events"] = intruder_trap_state["events"][:50]

    if intruder_trap_state.get("honeypot"):
        threading.Thread(target=launch_decoy_screen, daemon=True).start()

    return event

def _intruder_monitor_loop():
    while not _stop_intruder_event.is_set():
        time.sleep(2.5)
        if not intruder_trap_state["armed"]:
            break

        status = get_tamper_status()
        if status.get("tampered"):
            trigger_intruder_snapshot(reason=f"Hardware Tamper Alert: {status.get('alert')}")
            time.sleep(12)

class IntruderArmRequest(BaseModel):
    honeypot: bool = True
    trigger_mode: str = "all"

@router.post("/intruder/arm")
def arm_intruder_trap(req: IntruderArmRequest):
    """Arms silent intruder camera trap and honeypot decoy system."""
    global _intruder_thread
    intruder_trap_state["armed"] = True
    intruder_trap_state["honeypot"] = req.honeypot
    intruder_trap_state["trigger_mode"] = req.trigger_mode
    intruder_trap_state["armed_at"] = datetime.now().isoformat()

    _stop_intruder_event.clear()
    if _intruder_thread is None or not _intruder_thread.is_alive():
        _intruder_thread = threading.Thread(target=_intruder_monitor_loop, daemon=True)
        _intruder_thread.start()

    return {"success": True, "armed": True, "honeypot": req.honeypot}

@router.post("/intruder/disarm")
def disarm_intruder_trap():
    """Disarms intruder trap and closes any active honeypot decoy."""
    _stop_intruder_event.set()
    intruder_trap_state["armed"] = False
    close_decoy_screen()
    return {"success": True, "armed": False}

@router.get("/intruder/status")
def get_intruder_status():
    """Returns armed status, honeypot mode, and captured intruder log count."""
    return intruder_trap_state

@router.post("/intruder/trigger")
def test_trigger_intruder(reason: str = "Manual Security Test"):
    """Manually test intruder snapshot capture and decoy."""
    evt = trigger_intruder_snapshot(reason=reason)
    return {"success": True, "event": evt}

@router.get("/intruder/snapshots")
def list_intruder_snapshots():
    """Returns all captured intruder photos stored on Kali Linux."""
    snaps = []
    for f in sorted(CAPTURES_DIR.glob("intruder_*.jpg"), key=os.path.getmtime, reverse=True):
        snaps.append({
            "filename": f.name,
            "url": f"/api/security/intruder/snapshot/{f.name}",
            "size_bytes": f.stat().st_size,
            "timestamp": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
        })
    return {"snapshots": snaps, "total": len(snaps)}

@router.get("/intruder/snapshot/{filename}")
def get_intruder_snapshot_image(filename: str):
    """Streams a captured intruder snapshot image."""
    file_path = CAPTURES_DIR / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(file_path, media_type="image/jpeg")

@router.post("/decoy/launch")
def launch_decoy():
    """Immediately launches fullscreen Honeypot Decoy OS Update Screen."""
    ok = launch_decoy_screen()
    return {"success": ok}

@router.post("/decoy/close")
def close_decoy():
    """Closes the Honeypot Decoy OS Update Screen."""
    close_decoy_screen()
    return {"success": True}

