import base64
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Response, Request, Body, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from app.camera.camera_manager import camera_manager, CV2_AVAILABLE, TK_AVAILABLE

router = APIRouter(prefix="/camera", tags=["camera"])

@router.get("/status")
def get_camera_status():
    """Get status of laptop webcam, phone stream, and CCTV recording."""
    cctv = camera_manager.get_cctv_status()
    return {
        "laptop_camera_available": CV2_AVAILABLE,
        "desktop_window_available": TK_AVAILABLE,
        "phone_streaming_active": camera_manager.phone_streaming_active,
        "cctv_recording": cctv["is_recording"],
        "always_record": cctv.get("always_record", True),
        "cctv_chunk_remaining_sec": cctv["chunk_remaining_sec"],
        "cctv_total_chunks": cctv["total_chunks_recorded"],
        "resolution": cctv.get("resolution", "1280x720"),
        "night_mode": cctv.get("night_mode", False),
        "motion_detected": cctv.get("motion_detected", False),
        "motion_score": cctv.get("motion_score", 0.0),
        "motion_boxes": cctv.get("motion_boxes", []),
        "motion_sensitivity": cctv.get("motion_sensitivity", "medium"),
        "screen_is_off": cctv.get("screen_is_off", False),
        "keep_laptop_screen_off": cctv.get("keep_laptop_screen_off", True)
    }

@router.get("/laptop/stream")
def stream_laptop_camera(quality: int = Query(75, ge=30, le=95), fps: int = Query(30, ge=5, le=60)):
    """MJPEG stream of Kali Linux laptop webcam in HD to view in mobile browser."""
    return StreamingResponse(
        camera_manager.mjpeg_generator(quality=quality, target_fps=fps),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Accel-Buffering": "no"
        }
    )

@router.api_route("/laptop/audio", methods=["GET", "HEAD"])
@router.api_route("/audio", methods=["GET", "HEAD"])
@router.api_route("/audio/stream", methods=["GET", "HEAD"])
def stream_laptop_audio(request: Request):
    """Real-time live microphone audio stream from Kali Linux laptop for CCTV surveillance (supports noise cancellation)."""
    raw_denoise = request.query_params.get("denoise")
    denoise = None if raw_denoise is None else (raw_denoise in ("1", "true", "True"))
    if request.method == "HEAD":
        return Response(
            content=b"",
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "Accept-Ranges": "none",
                "X-Accel-Buffering": "no"
            }
        )

    return StreamingResponse(
        camera_manager.audio_stream_generator(denoise=denoise),
        media_type="audio/webm",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Accept-Ranges": "none",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/laptop/snapshot")
def get_laptop_snapshot(quality: int = Query(90, ge=30, le=100)):
    """Single high-definition snapshot from Kali laptop webcam."""
    camera_manager.start_laptop_camera()
    jpeg = camera_manager.read_laptop_jpeg(quality=quality)
    camera_manager.stop_laptop_camera()
    if jpeg:
        return Response(content=jpeg, media_type="image/jpeg")
    placeholder = camera_manager._generate_error_frame("Webcam Standby")
    return Response(content=placeholder, media_type="image/jpeg")

@router.post("/phone/frame")
async def receive_phone_frame(request: Request):
    """Receive camera frame from mobile phone and show on Kali laptop screen."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        b64_str = body.get("image", "")
        if b64_str:
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                frame_bytes = base64.b64decode(b64_str)
                camera_manager.receive_phone_frame(frame_bytes)
                return {"success": True}
            except Exception as e:
                return JSONResponse(status_code=400, content={"detail": str(e)})
    else:
        frame_bytes = await request.body()
        if frame_bytes:
            camera_manager.receive_phone_frame(frame_bytes)
            return {"success": True}

    return JSONResponse(status_code=400, content={"detail": "No image data received"})

@router.post("/phone/stop")
def stop_phone_camera():
    """Close phone camera stream and desktop window on Kali laptop."""
    camera_manager.stop_phone_stream()
    return {"success": True}

# =============================================================================
# 24/7 CCTV RECORDING & GOOGLE DRIVE CLOUD SYNC
# =============================================================================
@router.get("/cctv/settings")
def get_cctv_settings():
    """Get CCTV 24/7 settings (quality, night mode, motion detection, retention)."""
    return camera_manager.get_settings()

@router.post("/cctv/settings")
def update_cctv_settings(settings: dict = Body(...)):
    """Update CCTV settings dynamically."""
    return camera_manager.update_settings(settings)

@router.get("/cctv/events")
def get_cctv_events():
    """Get motion detection & surveillance event history."""
    return camera_manager.get_events()

@router.post("/cctv/start")
def start_cctv_recording(
    chunk_duration_sec: int = Body(1800, embed=True),
    auto_upload_gdrive: bool = Body(True, embed=True)
):
    """Start 30-minute rolling CCTV video recording."""
    res = camera_manager.start_cctv(chunk_duration_sec=chunk_duration_sec, auto_upload_gdrive=auto_upload_gdrive)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to start CCTV recording"))
    return res

@router.post("/cctv/stop")
def stop_cctv_recording():
    """Stop CCTV recording and finalize current video chunk."""
    return camera_manager.stop_cctv()

@router.get("/cctv/status")
def get_cctv_status():
    """Get live CCTV recording status, chunk progress, and Google Drive upload stats."""
    return camera_manager.get_cctv_status()

@router.get("/cctv/recordings")
def get_cctv_recordings():
    """List all recorded 30-minute CCTV video files."""
    return camera_manager.list_cctv_recordings()

@router.get("/cctv/download/{filename}")
def download_cctv_recording(filename: str):
    """Download recorded CCTV video file."""
    safe_filename = os.path.basename(filename)
    filepath = camera_manager.cctv_recordings_dir / safe_filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(filepath, media_type="video/mp4", filename=safe_filename)

@router.get("/cctv/stream-video/{filename}")
def stream_cctv_video(filename: str, request: Request):
    """Stream MP4 video chunk supporting HTTP 206 Range requests for in-app video scrubbing."""
    safe_filename = os.path.basename(filename)
    filepath = camera_manager.cctv_recordings_dir / safe_filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")

    stat = filepath.stat()
    file_size = stat.st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(filepath, media_type="video/mp4", filename=safe_filename)

    try:
        range_spec = range_header.strip().lower()
        if not range_spec.startswith("bytes="):
            return FileResponse(filepath, media_type="video/mp4", filename=safe_filename)

        parts = range_spec[6:].split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        chunk_len = end - start + 1

        def iter_file(path, offset, length):
            with open(path, "rb") as f:
                f.seek(offset)
                remaining = length
                while remaining > 0:
                    read_size = min(remaining, 64 * 1024)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_len),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(iter_file(filepath, start, chunk_len), status_code=206, headers=headers)
    except Exception:
        return FileResponse(filepath, media_type="video/mp4", filename=safe_filename)

@router.post("/cctv/upload-to-drive/{filename}")
def upload_cctv_to_gdrive(filename: str):
    """Trigger upload of specific CCTV video chunk to Google Drive."""
    safe_filename = os.path.basename(filename)
    filepath = camera_manager.cctv_recordings_dir / safe_filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail="Recording not found")

    camera_manager._upload_to_gdrive_worker(safe_filename)
    return {"success": True, "message": f"Upload queued for {safe_filename} to Google Drive folder 'Kali_CCTV_Recordings2.0'"}

@router.post("/cctv/screen-off")
def turn_laptop_screen_off():
    """Turn off the Kali Linux laptop display via hardware DPMS (Stealth CCTV Mode)."""
    ok = camera_manager.turn_laptop_screen_off()
    return {
        "success": ok,
        "message": "Kali laptop display turned OFF (Stealth mode active)",
        "screen_is_off": True
    }

@router.post("/cctv/screen-on")
def turn_laptop_screen_on():
    """Wake the Kali Linux laptop display."""
    ok = camera_manager.turn_laptop_screen_on()
    return {
        "success": ok,
        "message": "Kali laptop display awakened",
        "screen_is_off": False
    }

@router.get("/cctv/screen-status")
def get_laptop_screen_status():
    """Get current hardware power status of the Kali Linux laptop monitor."""
    return camera_manager.get_laptop_screen_status()

@router.get("/cctv/events/{filename}/snapshot")
def get_cctv_event_snapshot(filename: str):
    """Serve motion detection event snapshot with tactical HUD annotations."""
    safe_filename = os.path.basename(filename)
    filepath = camera_manager.cctv_events_dir / safe_filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail="Event snapshot not found")
    return FileResponse(filepath, media_type="image/jpeg", filename=safe_filename)

@router.post("/laptop/intercom")
async def receive_mobile_intercom(request: Request):
    """Receive microphone voice from mobile phone, play out loud through Kali laptop speakers,
    and save conversation to Google Drive Kali_CCTV_Recordings2.0.
    """
    content_type = request.headers.get("content-type", "")
    audio_bytes = b""

    if "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("audio") or form.get("file")
        if file_obj:
            audio_bytes = await file_obj.read()
    elif "application/json" in content_type:
        body = await request.json()
        b64 = body.get("audio", "")
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(b64)
    else:
        audio_bytes = await request.body()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received")

    res = camera_manager.play_mobile_intercom_audio(audio_bytes)
    return res

@router.get("/cctv/intercom-history")
def get_intercom_history():
    """List voice conversations between mobile and laptop speakers with Google Drive status."""
    return camera_manager.list_intercom_history()

@router.post("/cctv/motion-toggle")
def toggle_cctv_motion(payload: dict = Body(default={})):
    """Toggle or explicitly set CCTV motion detection ON or OFF."""
    enabled = payload.get("enabled") if isinstance(payload, dict) else None
    new_state = camera_manager.toggle_motion_detection(enabled)
    return {
        "success": True,
        "motion_detection_enabled": new_state,
        "message": f"Motion detection switched {'ON' if new_state else 'OFF'}"
    }

@router.post("/cctv/noise-cancellation")
def toggle_cctv_noise_cancellation(payload: dict = Body(default={})):
    """Toggle or explicitly set laptop microphone active noise cancellation ON or OFF."""
    enabled = payload.get("enabled") if isinstance(payload, dict) else None
    new_state = camera_manager.toggle_audio_noise_cancellation(enabled)
    return {
        "success": True,
        "audio_noise_cancellation": new_state,
        "message": f"Microphone Noise Cancellation switched {'ON' if new_state else 'OFF'}"
    }

@router.post("/cctv/auto-light")
def toggle_cctv_auto_light(payload: dict = Body(default={})):
    """Toggle or explicitly set camera auto-adjust lighting & dynamic exposure ON or OFF."""
    enabled = payload.get("enabled") if isinstance(payload, dict) else None
    new_state = camera_manager.toggle_auto_light_adjust(enabled)
    return {
        "success": True,
        "auto_light_adjust": new_state,
        "message": f"Camera Auto-Adjust Light switched {'ON' if new_state else 'OFF'}"
    }

from app.services.gdrive_service import gdrive_service
from app.database import SessionLocal
from app.models.entities import CctvRecordingEntity
from fastapi.responses import RedirectResponse

@router.get("/cctv/cloud-recordings")
def list_cctv_cloud_recordings():
    """List all CCTV video recordings stored in Google Drive cloud backup (works even when laptop is OFF)."""
    return gdrive_service.list_cloud_recordings()

@router.get("/cctv/cloud-stream/{identifier}")
def stream_cctv_cloud_recording(request: Request, identifier: str):
    """Stream CCTV video chunk with range request support for the in-app player."""
    safe_name = os.path.basename(identifier)
    local_path = camera_manager.cctv_recordings_dir / safe_name
    if local_path.is_file():
        return stream_cctv_recording(request, safe_name)

    db = SessionLocal()
    gdrive_id = identifier
    try:
        rec = db.query(CctvRecordingEntity).filter(
            (CctvRecordingEntity.filename == identifier) | (CctvRecordingEntity.gdrive_file_id == identifier)
        ).first()
        if rec and rec.gdrive_file_id:
            gdrive_id = rec.gdrive_file_id
            if rec.local_path and Path(rec.local_path).is_file():
                return stream_cctv_recording(request, os.path.basename(rec.local_path))
    finally:
        db.close()

    stream_url = f"https://drive.google.com/uc?export=download&id={gdrive_id}"
    return RedirectResponse(url=stream_url)

@router.get("/cctv/cloud-download/{identifier}")
def download_cctv_cloud_recording(identifier: str):
    """Directly download CCTV video chunk from Google Drive even if laptop is off."""
    safe_name = os.path.basename(identifier)
    local_path = camera_manager.cctv_recordings_dir / safe_name
    if local_path.is_file():
        return FileResponse(local_path, media_type="video/mp4", filename=safe_name)

    db = SessionLocal()
    gdrive_id = identifier
    try:
        rec = db.query(CctvRecordingEntity).filter(
            (CctvRecordingEntity.filename == identifier) | (CctvRecordingEntity.gdrive_file_id == identifier)
        ).first()
        if rec and rec.gdrive_file_id:
            gdrive_id = rec.gdrive_file_id
    finally:
        db.close()

    download_url = f"https://drive.google.com/uc?export=download&id={gdrive_id}"
    return RedirectResponse(url=download_url)


# ──────────────────────────────────────────────────────────────────────────
# EMERGENCY REMOTE SIREN & INTERCOM
# ──────────────────────────────────────────────────────────────────────────
from app.services.intercom_service import intercom_service
from app.services.gemini_service import gemini_service
from fastapi import UploadFile, File

@router.get("/siren/status")
def get_siren_status():
    """Returns whether the emergency siren is currently sounding."""
    return {"active": intercom_service.is_siren_active()}

@router.post("/siren/trigger")
def trigger_siren(payload: dict = Body(default={})):
    """Starts or stops the emergency maximum-volume alarm on laptop speakers."""
    action = payload.get("action", "start")
    duration = int(payload.get("duration_sec", 30))
    if action == "stop":
        return intercom_service.stop_emergency_siren()
    return intercom_service.start_emergency_siren(duration_sec=duration)

@router.post("/intercom/speak")
async def broadcast_intercom(audio_file: UploadFile = File(...)):
    """Receives voice audio from phone mic and broadcasts out laptop speakers in real-time."""
    data = await audio_file.read()
    fmt = "webm"
    if audio_file.filename and "." in audio_file.filename:
        fmt = audio_file.filename.rsplit(".", 1)[-1]
    return intercom_service.play_intercom_audio(data, audio_format=fmt)

@router.post("/cctv/ai-analyze")
def analyze_cctv_frame(payload: dict = Body(default={})):
    """Analyzes the latest CCTV snapshot or given event snapshot with Gemini Vision."""
    event_id = payload.get("event_id")
    target_img = None
    if event_id:
        img_p = camera_manager.cctv_events_dir / f"{event_id}.jpg"
        if img_p.exists():
            target_img = img_p.read_bytes()

    if not target_img:
        # Grab current camera frame
        frame = camera_manager.get_laptop_frame()
        if frame is not None:
            import cv2
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            target_img = buf.tobytes()

    if not target_img:
        return {"success": False, "summary": "No camera frame available to analyze."}

    return gemini_service.analyze_security_frame(target_img)


