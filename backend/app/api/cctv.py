import time
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from ..core.camera import camera_core
from ..core.recorder import cctv_recorder

router = APIRouter(prefix="/api/cctv", tags=["CCTV & 30-Min Recording"])

class CCTVToggleRequest(BaseModel):
    active: bool

class ThermalToggleRequest(BaseModel):
    enabled: bool

class TripwireConfigRequest(BaseModel):
    enabled: bool
    line_y: float = 0.5

class RecordStartRequest(BaseModel):
    source: str = "laptop"  # "laptop" or "mobile"
    duration_minutes: int = 30
    continuous_loop: bool = False

@router.get("/status")
def get_cctv_status():
    return {
        "success": True,
        "laptop_active": camera_core.laptop_active,
        "mobile_cctv_requested": camera_core.mobile_cctv_requested,
        "thermal_mode": camera_core.thermal_mode,
        "tripwire_enabled": camera_core.tripwire_enabled,
        "tripwire_triggered": camera_core.tripwire_triggered,
        "recorder": cctv_recorder.get_status()
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

# ──────────────────────────────────────────────────────────────────────────────
# 30-MINUTE CCTV RECORDING ENGINE ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/record/start")
def start_cctv_recording(req: RecordStartRequest):
    return cctv_recorder.start_recording(
        source=req.source,
        duration_minutes=req.duration_minutes,
        continuous_loop=req.continuous_loop
    )

@router.post("/record/stop")
def stop_cctv_recording():
    return cctv_recorder.stop_recording()

@router.get("/record/status")
def get_recording_status():
    return {
        "success": True,
        "recorder": cctv_recorder.get_status()
    }

@router.get("/recordings")
def list_cctv_recordings():
    return {
        "success": True,
        "recordings": cctv_recorder.list_recordings(),
        "recorder": cctv_recorder.get_status()
    }

@router.get("/recordings/play/{filename}")
def play_cctv_recording(filename: str):
    path = cctv_recorder.get_recording_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(path, media_type="video/mp4")

@router.get("/recordings/download/{filename}")
def download_cctv_recording(filename: str):
    path = cctv_recorder.get_recording_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)

@router.delete("/recordings/{filename}")
def delete_cctv_recording(filename: str):
    ok = cctv_recorder.delete_recording(filename)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete active or missing recording")
    return {"success": True, "deleted": filename}

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
        # Only turn off mobile cam if NOT currently recording mobile CCTV for 30 minutes
        if not (cctv_recorder.recording and cctv_recorder.source == "mobile"):
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
