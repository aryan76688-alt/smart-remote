from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List
from sqlalchemy.orm import Session
from app.schemas.common import SystemInfo, SystemStats, ProcessItem, KillProcessRequest, PowerRequest, QuickActionRequest
from app.system.monitor import system_monitor
from app.database import get_db
from app.models.entities import Activity
from app.services.tunnel_manager import tunnel_manager
import subprocess
import os

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/autostart")
def get_autostart_status():
    desktop_file = os.path.expanduser("~/.config/autostart/smart-remote.desktop")
    is_enabled = os.path.isfile(desktop_file)
    return {"enabled": is_enabled}

@router.post("/autostart")
def toggle_autostart(data: dict = Body(...)):
    enable = bool(data.get("enable", True))
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    script = os.path.join(project_root, "scripts", "enable_autostart.sh" if enable else "disable_autostart.sh")
    res = subprocess.run(["bash", script], capture_output=True, text=True)
    return {"enabled": enable, "success": res.returncode == 0}

@router.get("/info", response_model=SystemInfo)
def get_system_info():
    info = system_monitor.get_info()
    status = tunnel_manager.get_status()
    info.tunnel_url = status.get("public_url")
    info.tunnel_status = status.get("status")
    return info

@router.post("/quick-action")
def quick_action(req: QuickActionRequest, db: Session = Depends(get_db)):
    action = req.action
    cmd = None
    desc = ""
    
    if action == "sleep_display":
        cmd = "xset dpms force off"
        desc = "Put Kali display to sleep"
    elif action == "wake_display":
        cmd = "xset dpms force on && xdotool key Shift_L"
        desc = "Woke Kali display"
    elif action == "clear_cache":
        cmd = "sync && sudo -n sysctl vm.drop_caches=3 2>/dev/null || sync"
        desc = "Cleared system memory cache & synced disk"
    elif action == "mute_audio":
        cmd = "pactl set-sink-mute @DEFAULT_SINK@ toggle || amixer set Master toggle"
        desc = "Toggled master audio mute"
    elif action == "lock_session":
        cmd = "loginctl lock-session || xdg-screensaver lock || xflock4"
        desc = "Locked desktop session"
    elif action == "screenshot":
        cmd = "import -window root /tmp/remote_screenshot.png 2>/dev/null || maim /tmp/remote_screenshot.png 2>/dev/null || scrot /tmp/remote_screenshot.png 2>/dev/null"
        desc = "Captured desktop screenshot"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported quick action: {action}")
    
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
        success = res.returncode == 0
    except Exception as e:
        success = False

    db.add(Activity(
        action_type="system",
        description=f"Quick action: {desc}",
        result="success" if success else "executed"
    ))
    db.commit()
    return {"success": True, "action": action, "description": desc}

@router.get("/stats", response_model=SystemStats)
def get_system_stats():
    return system_monitor.get_stats()

@router.get("/processes", response_model=List[ProcessItem])
def get_processes(limit: int = 40, sort: str = "cpu"):
    return system_monitor.list_processes(limit=limit, sort_by=sort)

@router.post("/kill")
def kill_process(req: KillProcessRequest, db: Session = Depends(get_db)):
    success = system_monitor.kill_process(req.pid, req.signal)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to kill PID {req.pid}")
    
    # Log activity
    db.add(Activity(
        action_type="system",
        description=f"Killed process PID {req.pid} with signal {req.signal}",
        result="success"
    ))
    db.commit()
    return {"success": True, "pid": req.pid}

@router.post("/power")
def power_control(req: PowerRequest, db: Session = Depends(get_db)):
    if req.action in ("reboot", "shutdown", "logout") and not req.confirmed:
        raise HTTPException(status_code=400, detail=f"Action '{req.action}' requires explicit confirmation")
    
    res = system_monitor.power_action(req.action)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to execute power action"))
    
    db.add(Activity(
        action_type="system",
        description=f"Executed power command '{req.action}'",
        result="success"
    ))
    db.commit()
    return res
