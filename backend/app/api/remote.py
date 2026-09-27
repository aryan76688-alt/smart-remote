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

