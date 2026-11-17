import os
import subprocess
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Response
from app.schemas.common import InputPointerEvent, InputKeyEvent, InputDPadEvent, MediaCommandRequest
from app.input.controller import input_controller
from app.screen.streamer import screen_streamer

router = APIRouter(prefix="/remote", tags=["remote"])

@router.post("/pointer")
def handle_pointer(evt: InputPointerEvent):
    if evt.type == "move_rel":
        res = input_controller.move_relative(evt.x or 0.0, evt.y or 0.0)
    elif evt.type == "move_abs":
        res = input_controller.move_absolute(evt.x or 0.0, evt.y or 0.0)
    elif evt.type == "click":
        res = input_controller.click(evt.button or 1)
    elif evt.type == "doubleclick":
        res = input_controller.double_click(evt.button or 1)
    elif evt.type == "mousedown":
        res = input_controller.mouse_down(evt.button or 1)
    elif evt.type == "mouseup":
        res = input_controller.mouse_up(evt.button or 1)
    elif evt.type == "scroll":
        res = input_controller.scroll(evt.scroll_delta_y or 0.0, evt.scroll_delta_x or 0.0)
    else:
        res = False
    return {"success": res}

@router.post("/key")
def handle_key(evt: InputKeyEvent):
    if evt.type == "keydown":
        res = input_controller.key_down(evt.key)
    elif evt.type == "keyup":
        res = input_controller.key_up(evt.key)
    else:
        res = input_controller.key_press(evt.key, evt.modifiers)
    return {"success": res}

@router.post("/dpad")
def handle_dpad(evt: InputDPadEvent):
    res = input_controller.dpad_move(evt.direction, evt.step, evt.precision)
    return {"success": res}

@router.post("/media")
def handle_media(req: MediaCommandRequest):
    if req.action == "launch_ott" and req.ott_app:
        res = input_controller.launch_ott(req.ott_app)
    else:
        res = input_controller.media_action(req.action, req.volume_level)
    return {"success": res}

@router.get("/screenshot")
def take_screenshot():
    img_bytes = screen_streamer.capture_screenshot("png")
    if not img_bytes:
        return Response(content=b"", status_code=500)
    return Response(content=img_bytes, media_type="image/png")

@router.post("/unlock-screen")
@router.post("/wake-screen")
def unlock_screen():
    res = input_controller.unlock_screen()
    return {"success": res, "message": "Workstation screen awakened and unlocked"}

# =============================================================================
# MOBILE SCREEN MIRRORING (MediaProjection -> Web Cockpit)
# =============================================================================
import time
from fastapi.responses import StreamingResponse
from fastapi import Request

_latest_mobile_screen_frame = None
_last_mobile_screen_time = 0.0
_mobile_screen_fps = 0.0
_mobile_screen_fps_tracker = []
_mobile_mirror_requested = False

@router.post("/screen/mobile/frame")
async def receive_mobile_screen_frame(request: Request):
    """Receives live screen mirror frame from Android phone."""
    global _latest_mobile_screen_frame, _last_mobile_screen_time, _mobile_screen_fps, _mobile_screen_fps_tracker
    body = await request.body()
    if body:
        now = time.time()
        _latest_mobile_screen_frame = body
        _last_mobile_screen_time = now
        _mobile_screen_fps_tracker.append(now)
        _mobile_screen_fps_tracker = [t for t in _mobile_screen_fps_tracker if now - t <= 2.0]
        _mobile_screen_fps = len(_mobile_screen_fps_tracker) / 2.0
        return {"success": True, "bytes": len(body)}
    return {"success": False, "error": "Empty frame"}

def _mobile_screen_stream_gen():
    global _latest_mobile_screen_frame, _last_mobile_screen_time
    while True:
        frame = _latest_mobile_screen_frame if (time.time() - _last_mobile_screen_time < 5.0) else None
        if frame:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            )
            time.sleep(0.035)
        else:
            # Standby blank / error frame
            err_frame = b""
            try:
                from app.camera.camera_manager import camera_manager
                err_frame = camera_manager._generate_error_frame("OPPO Screen Mirror Standby")
            except Exception:
                pass
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + err_frame + b"\r\n"
            )
            time.sleep(0.1)

@router.get("/screen/mobile/stream")
def stream_mobile_screen():
    """Live MJPEG video stream of mirrored mobile phone display."""
    return StreamingResponse(
        _mobile_screen_stream_gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/screen/mobile/snapshot")
def get_mobile_screen_snapshot():
    """Returns single snapshot of mirrored mobile display."""
    global _latest_mobile_screen_frame, _last_mobile_screen_time
    if _latest_mobile_screen_frame and (time.time() - _last_mobile_screen_time < 5.0):
        return Response(content=_latest_mobile_screen_frame, media_type="image/jpeg")
    from app.camera.camera_manager import camera_manager
    standby = camera_manager._generate_error_frame("OPPO Screen Standby")
    return Response(content=standby, media_type="image/jpeg")

@router.get("/screen/mobile/status")
def get_mobile_screen_status():
    global _last_mobile_screen_time, _mobile_screen_fps, _mobile_mirror_requested
    now = time.time()
    active = (now - _last_mobile_screen_time < 5.0) if _last_mobile_screen_time else False
    return {
        "active": active,
        "requested": bool(_mobile_mirror_requested),
        "fps": round(_mobile_screen_fps, 1),
        "last_frame_sec": round(now - _last_mobile_screen_time, 1) if _last_mobile_screen_time else None
    }

@router.post("/screen/mobile/control")
async def control_mobile_screen(request: Request):
    """Controls mobile screen mirroring state (start or stop) dispatched to phone."""
    global _mobile_mirror_requested
    body = await request.json()
    action = body.get("action", "")
    from app.api.tracking import devices_registry
    if action == "start":
        _mobile_mirror_requested = True
        if "oppo" in devices_registry:
            devices_registry["oppo"]["mirror_active"] = True
        return {"success": True, "active": True, "message": "Screen mirror requested on Oppo phone"}
    elif action == "stop":
        _mobile_mirror_requested = False
        if "oppo" in devices_registry:
            devices_registry["oppo"]["mirror_active"] = False
        return {"success": True, "active": False, "message": "Screen mirror stopped"}
    return {"success": False, "error": f"Unknown action: {action}"}

# =============================================================================
# PRESENTATION SLIDE CLICKER & LASER
# =============================================================================
class PresentationEvent(BaseModel):
    command: str

@router.post("/presentation")
def handle_presentation(evt: PresentationEvent):
    """Handles slide presentations (PowerPoint, Google Slides, PDF, Keynote)."""
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    cmd_map = {
        "next": "Right",
        "prev": "Left",
        "blank": "b",
        "start": "F5",
        "escape": "Escape"
    }
    key = cmd_map.get(evt.command.lower(), "Right")
    try:
        ok = input_controller.key_press(key)
        return {"success": ok, "command": evt.command, "key": key}
    except Exception as e:
        return {"success": False, "error": str(e)}

# =============================================================================
# VIRTUAL GAMEPAD / CONTROLLER
# =============================================================================
class GamepadEvent(BaseModel):
    action: str
    button: Optional[str] = None

@router.post("/gamepad")
def handle_gamepad(evt: GamepadEvent):
    """Maps virtual controller buttons to keyboard keys for remote gaming."""
    env = os.environ.copy()
    if "DISPLAY" not in env:
        env["DISPLAY"] = ":0.0"
    btn_map = {
        "A": "space",
        "B": "Return",
        "X": "x",
        "Y": "y",
        "L1": "q",
        "R1": "e",
        "UP": "Up",
        "DOWN": "Down",
        "LEFT": "Left",
        "RIGHT": "Right",
        "START": "Escape",
        "SELECT": "Tab"
    }
    if evt.action in ("btn_down", "btn_press") and evt.button in btn_map:
        key = btn_map[evt.button]
        try:
            ok = input_controller.key_press(key)
            return {"success": ok, "button": evt.button}
        except Exception as e:
            return {"success": False, "error": str(e)}
    return {"success": True}

# =============================================================================
# AIR MOUSE / GYROSCOPIC 3D POINTER (Feature 6)
# =============================================================================
class GyroPointerEvent(BaseModel):
    dx: float = 0.0
    dy: float = 0.0
    click: Optional[str] = None  # "left", "right", "down", "up"

@router.post("/gyro-pointer")
def handle_gyro_pointer(evt: GyroPointerEvent):
    """Streams phone gyroscope movements to move pearOS mouse pointer with zero lag."""
    if evt.click == "left":
        input_controller.click(1)
    elif evt.click == "right":
        input_controller.click(3)
    elif evt.click == "down":
        input_controller.mouse_down(1)
    elif evt.click == "up":
        input_controller.mouse_up(1)

    if evt.dx != 0.0 or evt.dy != 0.0:
        input_controller.move_relative(evt.dx, evt.dy)

    return {"success": True}

# =============================================================================
# MULTI-TOUCH TRACKPAD GESTURES (Feature 9)
# =============================================================================
class GestureEvent(BaseModel):
    gesture: str  # "scroll", "pinch_in", "pinch_out", "swipe_up", "swipe_down", "swipe_left", "swipe_right"
    delta_x: Optional[float] = 0.0
    delta_y: Optional[float] = 0.0
    scale: Optional[float] = 1.0

@router.post("/gestures")
def handle_gestures(evt: GestureEvent):
    """Executes kinetic 2-finger scrolls, pinch-to-zoom, and 3-finger macOS Sequoia gestures."""
    g = evt.gesture.lower().strip()
    success = True
    try:
        if g == "scroll":
            input_controller.scroll(evt.delta_y or 0.0, evt.delta_x or 0.0)
        elif g == "pinch_in":
            # Zoom out
            input_controller.key_press("minus", ["ctrl"])
        elif g == "pinch_out":
            # Zoom in
            input_controller.key_press("plus", ["ctrl"])
        elif g == "swipe_up":
            # Mission Control / Overview
            input_controller.key_press("Super_L")
        elif g == "swipe_down":
            # Show Desktop
            input_controller.key_press("d", ["ctrl", "alt"])
        elif g == "swipe_left":
            # Workspace switch left
            input_controller.key_press("Left", ["ctrl", "alt"])
        elif g == "swipe_right":
            # Workspace switch right
            input_controller.key_press("Right", ["ctrl", "alt"])
        else:
            success = False
    except Exception as e:
        return {"success": False, "error": str(e)}

    return {"success": success, "gesture": g}

# =============================================================================
# MOBILE BARCODE & QR CODE SCANNER TO PC (Feature 13)
# =============================================================================
class TypeScannedRequest(BaseModel):
    text: str
    press_enter: Optional[bool] = True

@router.post("/type-scanned")
def type_scanned_barcode(req: TypeScannedRequest):
    """Types scanned QR code or Barcode text directly into pearOS active cursor with sub-millisecond latency."""
    text = req.text.strip()
    if not text:
        return {"success": False, "error": "Empty text"}
    try:
        ok = input_controller.type_text(text)
        if req.press_enter:
            input_controller.key_press("Return")
        return {"success": ok, "typed": text}
    except Exception as e:
        return {"success": False, "error": str(e)}

# =============================================================================
# PHYSICAL VOLUME BUTTON SHORTCUTS (Feature 10)
# =============================================================================
class VolumeShortcutRequest(BaseModel):
    key: str  # "volume_up", "volume_down"
    action: Optional[str] = None  # "lock_screen", "snap_cctv", "mute_toggle"

@router.post("/volume-shortcut")
def handle_volume_shortcut(req: VolumeShortcutRequest):
    """Triggers customizable action on physical phone volume button click."""
    action = req.action or ("snap_cctv" if req.key == "volume_up" else "lock_screen")
    res = {"success": True, "action": action}
    try:
        if action == "lock_screen":
            import subprocess
            subprocess.run(["loginctl", "lock-session"], check=False)
            res["message"] = "pearOS Screen Locked"
        elif action == "snap_cctv":
            from app.camera.camera_manager import camera_manager
            camera_manager.start_laptop_camera()
            _ = camera_manager.read_laptop_jpeg(quality=90)
            res["message"] = "CCTV Photo Captured into RAM"
        elif action == "mute_toggle":
            input_controller.media_action("mute")
            res["message"] = "Audio Muted"
    except Exception as e:
        return {"success": False, "error": str(e)}
    return res

# =============================================================================
# INTERACTIVE OLED TOUCH BAR (Feature 2)
# =============================================================================
@router.get("/touchbar")
def get_touchbar_items():
    """Detects active window context and returns tailored dynamic Apple Touch Bar items."""
    active_app = "pearOS System"
    try:
        res = subprocess.run(["xprop", "-root", "_NET_ACTIVE_WINDOW"], capture_output=True, text=True, timeout=1)
        if res.returncode == 0 and "window id #" in res.stdout:
            win_id = res.stdout.split("window id #")[1].strip().split()[0]
            name_res = subprocess.run(["xprop", "-id", win_id, "WM_CLASS"], capture_output=True, text=True, timeout=1)
            if name_res.returncode == 0:
                active_app = name_res.stdout.split('"')[-2]
    except Exception:
        pass

    app_lower = active_app.lower()
    if "code" in app_lower or "term" in app_lower or "bash" in app_lower:
        items = [
            {"id": "tb_run", "label": "▶ Run", "action": "key_f5", "color": "#34C759"},
            {"id": "tb_save", "label": "⌘ Save", "action": "key_ctrl_s", "color": "#007AFF"},
            {"id": "tb_term", "label": "Terminal", "action": "key_ctrl_tick", "color": "#5856D6"},
            {"id": "tb_git", "label": "Git Status", "action": "type_git_status", "color": "#FF9500"}
        ]
    elif "chrome" in app_lower or "browser" in app_lower or "firefox" in app_lower:
        items = [
            {"id": "tb_back", "label": "◀ Back", "action": "key_alt_left", "color": "#007AFF"},
            {"id": "tb_fwd", "label": "▶ Forward", "action": "key_alt_right", "color": "#007AFF"},
            {"id": "tb_reload", "label": "↻ Reload", "action": "key_ctrl_r", "color": "#34C759"},
            {"id": "tb_newtab", "label": "+ Tab", "action": "key_ctrl_t", "color": "#5856D6"}
        ]
    else:
        items = [
            {"id": "tb_play", "label": "⏯ Play/Pause", "action": "media_play", "color": "#007AFF"},
            {"id": "tb_mute", "label": "🔇 Mute", "action": "media_mute", "color": "#FF3B30"},
            {"id": "tb_scr", "label": "📸 Screenshot", "action": "key_print", "color": "#AF52DE"},
            {"id": "tb_lock", "label": "🔒 Lock", "action": "lock_screen", "color": "#8E8E93"}
        ]

    return {"success": True, "active_app": active_app, "items": items}

class TouchBarExecuteRequest(BaseModel):
    action: str

@router.post("/touchbar/execute")
def execute_touchbar_action(req: TouchBarExecuteRequest):
    """Executes a touchbar action with native sub-millisecond X11 injection."""
    act = req.action
    if act == "media_play":
        input_controller.media_action("play_pause")
    elif act == "media_mute":
        input_controller.media_action("mute")
    elif act == "key_ctrl_s":
        input_controller.key_press("s", ["ctrl"])
    elif act == "key_f5":
        input_controller.key_press("F5")
    elif act == "key_ctrl_tick":
        input_controller.key_press("grave", ["ctrl"])
    elif act == "key_ctrl_r":
        input_controller.key_press("r", ["ctrl"])
    elif act == "key_ctrl_t":
        input_controller.key_press("t", ["ctrl"])
    elif act == "key_alt_left":
        input_controller.key_press("Left", ["alt"])
    elif act == "key_alt_right":
        input_controller.key_press("Right", ["alt"])
    elif act == "key_print":
        input_controller.key_press("Print")
    elif act == "lock_screen":
        subprocess.run(["loginctl", "lock-session"], check=False)
    elif act == "type_git_status":
        input_controller.type_text("git status\n")
    return {"success": True, "action": act}

# =============================================================================
# PHONE AS WIRELESS DRAWING TABLET (Feature 4)
# =============================================================================
class TabletStrokeRequest(BaseModel):
    x: float
    y: float
    pressure: Optional[float] = 1.0
    is_down: Optional[bool] = False
    is_up: Optional[bool] = False

@router.post("/tablet-stroke")
def handle_tablet_stroke(req: TabletStrokeRequest):
    """Maps mobile stylus / finger touch coordinates directly to pearOS drawing cursor."""
    screen_w = 1920
    screen_h = 1080
    target_x = int(req.x * screen_w) if req.x <= 1.0 else int(req.x)
    target_y = int(req.y * screen_h) if req.y <= 1.0 else int(req.y)
    
    input_controller.move_absolute(target_x, target_y)
    if req.is_down:
        input_controller.mouse_down(1)
    elif req.is_up:
        input_controller.mouse_up(1)
    return {"success": True, "x": target_x, "y": target_y}

# =============================================================================
# VIRTUAL GAME CONTROLLER WITH GYRO AIMING (Feature 16)
# =============================================================================
class GamepadEventRequest(BaseModel):
    button: Optional[str] = None
    is_pressed: Optional[bool] = True
    lx: Optional[float] = 0.0
    ly: Optional[float] = 0.0
    rx: Optional[float] = 0.0
    ry: Optional[float] = 0.0
    gyro_x: Optional[float] = 0.0
    gyro_y: Optional[float] = 0.0

@router.post("/gamepad-event")
def handle_gamepad_event(req: GamepadEventRequest):
    """Maps virtual controller buttons and gyro aiming to native pearOS inputs."""
    btn_map = {
        "A": "space", "B": "Escape", "X": "x", "Y": "y",
        "L1": "q", "R1": "e", "UP": "Up", "DOWN": "Down",
        "LEFT": "Left", "RIGHT": "Right", "START": "Return", "SELECT": "Tab"
    }
    if req.button and req.button in btn_map:
        key = btn_map[req.button]
        if req.is_pressed:
            input_controller.key_down(key)
        else:
            input_controller.key_up(key)

    dx = (req.rx or 0.0) * 15.0 + (req.gyro_x or 0.0) * 8.0
    dy = (req.ry or 0.0) * 15.0 + (req.gyro_y or 0.0) * 8.0
    if abs(dx) > 0.5 or abs(dy) > 0.5:
        input_controller.move_relative(dx, dy)

    return {"success": True}

# =============================================================================
# GESTURE-BASED AIR VOLUME WHEEL (Feature 20)
# =============================================================================
class AirVolumeRequest(BaseModel):
    delta_roll: float

@router.post("/air-volume")
def handle_air_volume(req: AirVolumeRequest):
    """Twisting phone in mid-air smoothly turns pearOS master volume up or down."""
    if abs(req.delta_roll) >= 2.0:
        steps = int(req.delta_roll / 2.0)
        action = "volume_up" if steps > 0 else "volume_down"
        for _ in range(min(abs(steps), 5)):
            input_controller.media_action(action)
        return {"success": True, "action": action, "steps": abs(steps)}
    return {"success": True, "action": "none"}

# =============================================================================
# UNIVERSAL MOUSE CROSSING (Feature 29)
# =============================================================================
_edge_crossing_state = {"crossed_to_mobile": False, "last_edge": None, "timestamp": 0.0}

class EdgeCrossingRequest(BaseModel):
    edge: str

@router.post("/edge-crossing")
def handle_edge_crossing(req: EdgeCrossingRequest):
    """Seamlessly transfers cursor focus between pearOS screen and mobile interface."""
    global _edge_crossing_state
    _edge_crossing_state = {
        "crossed_to_mobile": True,
        "last_edge": req.edge,
        "timestamp": time.time()
    }
    return {"success": True, "state": _edge_crossing_state}

@router.get("/edge-crossing/status")
def get_edge_crossing_status():
    return {"success": True, "state": _edge_crossing_state}

# =============================================================================
# SILENT FLIP-TO-LOCK GESTURE (Feature 34)
# =============================================================================
@router.post("/flip-lock")
def handle_flip_lock():
    """Placing phone face-down triggers immediate lock and master audio mute."""
    import subprocess
    subprocess.run(["loginctl", "lock-session"], check=False)
    input_controller.media_action("mute")
    return {"success": True, "locked": True, "muted": True}



