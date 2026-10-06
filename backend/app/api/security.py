import glob
import os
import subprocess
from fastapi import APIRouter, HTTPException
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
