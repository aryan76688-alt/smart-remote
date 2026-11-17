from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from ..core.input import input_controller

router = APIRouter(prefix="/api/remote", tags=["Remote Control"])

class MouseMoveRequest(BaseModel):
    dx: float
    dy: float

class MouseClickRequest(BaseModel):
    button: int = 1  # 1=left, 2=middle, 3=right
    double: bool = False

class ScrollRequest(BaseModel):
    dy: float

class KeyTypeRequest(BaseModel):
    text: str

class ShortcutRequest(BaseModel):
    shortcut: str  # e.g. "ctrl+c", "alt+Tab", "Super_L"

class GyroPointerRequest(BaseModel):
    alpha: float
    beta: float
    gamma: float

@router.post("/move")
def move_cursor(req: MouseMoveRequest):
    success = input_controller.move_cursor_relative(int(req.dx), int(req.dy))
    return {"success": success}

@router.post("/click")
def click_mouse(req: MouseClickRequest):
    success = input_controller.click(button=req.button, double=req.double)
    return {"success": success}

@router.post("/scroll")
def scroll_mouse(req: ScrollRequest):
    success = input_controller.scroll(int(req.dy))
    return {"success": success}

@router.post("/mouse-down")
def mouse_down(req: MouseClickRequest):
    success = input_controller.mouse_down(button=req.button)
    return {"success": success}

@router.post("/mouse-up")
def mouse_up(req: MouseClickRequest):
    success = input_controller.mouse_up(button=req.button)
    return {"success": success}

@router.post("/type")
def type_text(req: KeyTypeRequest):
    success = input_controller.type_text(req.text)
    return {"success": success}

@router.post("/shortcut")
def trigger_shortcut(req: ShortcutRequest):
    success = input_controller.send_shortcut(req.shortcut)
    return {"success": success}

@router.post("/gyro-pointer")
def handle_gyro_pointer(req: GyroPointerRequest):
    # Deadzone filtering and scale factor for fluid air mouse steering
    dx = -req.gamma * 1.8
    dy = -req.beta * 1.8
    if abs(dx) < 0.6:
        dx = 0
    if abs(dy) < 0.6:
        dy = 0
    success = input_controller.move_cursor_relative(int(dx), int(dy))
    return {"success": success}

@router.get("/touchbar")
def get_touchbar():
    # Context-adaptive OLED Touch Bar strip
    return {
        "success": True,
        "active_app": "pearOS Nexus",
        "items": [
            {"id": "tb_play", "label": "⏯ Play/Pause", "action": "media_play", "color": "#007AFF"},
            {"id": "tb_mute", "label": "🔇 Mute", "action": "media_mute", "color": "#FF3B30"},
            {"id": "tb_shot", "label": "📸 Screenshot", "action": "key_print", "color": "#AF52DE"},
            {"id": "tb_term", "label": "💻 Terminal", "action": "launch_terminal", "color": "#34C759"},
            {"id": "tb_lock", "label": "🔒 Lock", "action": "lock_screen", "color": "#8E8E93"}
        ]
    }

@router.post("/touchbar/execute")
def execute_touchbar_action(req: ShortcutRequest):
    action = req.shortcut
    if action == "media_play":
        input_controller.send_shortcut("XF86AudioPlay")
    elif action == "media_mute":
        input_controller.send_shortcut("XF86AudioMute")
    elif action == "key_print":
        input_controller.send_shortcut("Print")
    elif action == "launch_terminal":
        import subprocess
        subprocess.Popen(["konsole"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif action == "lock_screen":
        import subprocess
        subprocess.run(["loginctl", "lock-session"], check=False)
    return {"success": True, "action": action}
