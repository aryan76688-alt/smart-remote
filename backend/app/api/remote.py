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


