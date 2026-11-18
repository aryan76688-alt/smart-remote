import time
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from typing import Optional
from ..core.camera import camera_core
from ..core.tunnel import tunnel_manager
from .maps import current_device_location, location_breadcrumbs

router = APIRouter(tags=["Android Companion Bridge"])

# Live companion phone state (in-RAM only)
phone_state = {
    "device_id": "oppo-phone",
    "name": "Oppo Companion",
    "model": "Android",
    "battery": 0,
    "is_charging": False,
    "last_seen": 0.0,
    "daemon_active": False,
    "siren": False,
    "strobe": False,
}

class PhoneControlRequest(BaseModel):
    siren: Optional[bool] = None
    strobe: Optional[bool] = None
    camera: Optional[bool] = None

@router.get("/api/system/info")
def system_info():
    return {
        "success": True,
        "system": "pearOS Nexus 3.0",
        "status": "online",
        "tunnel": tunnel_manager.get_status()
    }

@router.get("/api/tunnel/status")
def get_tunnel_status():
    return tunnel_manager.get_status()

@router.post("/api/tracking/device/update")
async def update_companion_telemetry(request: Request):
    """Receives 24/7 background telemetry from Android SmartRemoteDaemonService."""
    data = await request.json()

    phone_state["device_id"] = data.get("device_id", phone_state["device_id"])
    phone_state["name"] = data.get("name", phone_state["name"])
    phone_state["model"] = data.get("model", phone_state["model"])
    phone_state["battery"] = data.get("battery", phone_state["battery"])
    phone_state["is_charging"] = bool(data.get("is_charging", False))
    phone_state["daemon_active"] = bool(data.get("daemon_active", True))
    phone_state["last_seen"] = time.time()

    # Sync real GPS coordinates to Google Maps tracker
    lat = data.get("lat")
    lng = data.get("lng")
    if lat is not None and lng is not None and (lat != 0 or lng != 0):
        current_device_location["latitude"] = float(lat)
        current_device_location["longitude"] = float(lng)
        current_device_location["accuracy_m"] = float(data.get("accuracy", 10.0))
        current_device_location["speed_mps"] = float(data.get("speed", 0.0))
        current_device_location["heading_deg"] = float(data.get("heading", 0.0))
        current_device_location["last_updated"] = time.time()

        location_breadcrumbs.append({
            "lat": float(lat),
            "lng": float(lng),
            "time": time.time()
        })
        if len(location_breadcrumbs) > 100:
            location_breadcrumbs.pop(0)

    # Auto-expire mobile CCTV request if nobody viewed the stream for 15 seconds
    if camera_core.mobile_cctv_requested and (time.time() - camera_core.mobile_last_active_time > 15.0):
        camera_core.set_mobile_cctv_requested(False)

    return {
        "success": True,
        "actions": {
            "siren": phone_state["siren"],
            "strobe": phone_state["strobe"],
            "camera": camera_core.mobile_cctv_requested
        }
    }

@router.post("/api/camera/phone/frame")
async def receive_phone_camera_frame(request: Request):
    """Receives raw image/jpeg frame from Android background CCTV camera."""
    body = await request.body()
    if body:
        camera_core.update_mobile_frame(body)
    return {"success": True, "bytes": len(body)}

@router.get("/api/camera/phone/frame")
def get_phone_camera_frame():
    frame = camera_core.get_mobile_frame()
    return Response(content=frame, media_type="image/jpeg")

@router.get("/api/phone/status")
def get_phone_status():
    age = time.time() - phone_state["last_seen"] if phone_state["last_seen"] > 0 else 9999
    return {
        "success": True,
        "online": age < 30.0,
        "last_seen_seconds_ago": round(age, 1) if phone_state["last_seen"] > 0 else None,
        "phone": phone_state,
        "mobile_cctv_active": camera_core.mobile_cctv_requested
    }

@router.post("/api/phone/control")
def control_phone(req: PhoneControlRequest):
    if req.siren is not None:
        phone_state["siren"] = req.siren
    if req.strobe is not None:
        phone_state["strobe"] = req.strobe
    if req.camera is not None:
        camera_core.set_mobile_cctv_requested(req.camera)
    return {"success": True, "actions": {
        "siren": phone_state["siren"],
        "strobe": phone_state["strobe"],
        "camera": camera_core.mobile_cctv_requested
    }}

@router.get("/api/phone-files/poll")
def poll_phone_files(device_id: str = "oppo"):
    return {"success": True, "tasks": []}
