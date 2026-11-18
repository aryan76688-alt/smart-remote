import time
from fastapi import APIRouter, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ..core.camera import camera_core

router = APIRouter(prefix="/api/cctv", tags=["CCTV"])

class CCTVToggleRequest(BaseModel):
    active: bool

class ThermalToggleRequest(BaseModel):
    enabled: bool

class TripwireConfigRequest(BaseModel):
    enabled: bool
    line_y: float = 0.5

@router.get("/status")
def get_cctv_status():
    return {
        "success": True,
        "laptop_active": camera_core.laptop_active,
        "mobile_cctv_requested": camera_core.mobile_cctv_requested,
        "thermal_mode": camera_core.thermal_mode,
        "tripwire_enabled": camera_core.tripwire_enabled,
        "tripwire_triggered": camera_core.tripwire_triggered
    }

@router.post("/laptop/toggle")
def toggle_laptop_cctv(req: CCTVToggleRequest):
    if req.active:
        camera_core.start_laptop_cam()
    else:
        camera_core.stop_laptop_cam()
    return {"success": True, "laptop_active": camera_core.laptop_active}

@router.post("/mobile/toggle")
def toggle_mobile_cctv(req: CCTVToggleRequest):
    """Signals whether mobile phone should be streaming CCTV frames."""
    camera_core.set_mobile_cctv_requested(req.active)
    return {"success": True, "mobile_cctv_requested": camera_core.mobile_cctv_requested}

@router.get("/mobile/poll-request")
def poll_mobile_cctv_request():
    """Polled by Android companion APK background service to know when to stream."""
    return {
        "success": True,
        "cctv_requested": camera_core.mobile_cctv_requested
    }

@router.post("/mobile/push")
async def push_mobile_frame(file: UploadFile = File(...)):
    """Receives in-memory JPEG frame from Android phone camera."""
    contents = await file.read()
    camera_core.update_mobile_frame(contents)
    return {"success": True, "bytes_received": len(contents)}

@router.post("/thermal-mode")
def toggle_thermal(req: ThermalToggleRequest):
    camera_core.thermal_mode = req.enabled
    return {"success": True, "thermal_mode": camera_core.thermal_mode}

@router.post("/tripwire")
def configure_tripwire(req: TripwireConfigRequest):
    camera_core.tripwire_enabled = req.enabled
    camera_core.tripwire_line_y = req.line_y
    return {
        "success": True,
        "tripwire_enabled": camera_core.tripwire_enabled,
        "line_y": camera_core.tripwire_line_y
    }

def _stream_laptop_feed():
    camera_core.start_laptop_cam()
    while True:
        frame = camera_core.get_laptop_frame()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        time.sleep(0.04)

def _stream_mobile_feed():
    camera_core.set_mobile_cctv_requested(True)
    try:
        while True:
            camera_core.mobile_last_active_time = time.time()
            frame = camera_core.get_mobile_frame()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.08)
    finally:
        camera_core.set_mobile_cctv_requested(False)

@router.get("/laptop/stream.mjpg")
def stream_laptop_cctv():
    return StreamingResponse(
        _stream_laptop_feed(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/mobile/stream.mjpg")
def stream_mobile_cctv():
    return StreamingResponse(
        _stream_mobile_feed(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
