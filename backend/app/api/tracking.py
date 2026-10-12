import time
import os
import json
import subprocess
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services.geolocation_service import geolocation_service

router = APIRouter(prefix="/tracking", tags=["tracking"])

FLEET_STORE_FILE = "/tmp/smart-remote-fleet.json"
BREADCRUMBS_FILE = "/tmp/smart-remote-breadcrumbs.json"

class DeviceUpdate(BaseModel):
    device_id: str
    name: Optional[str] = None
    model: Optional[str] = None
    role: Optional[str] = "mobile"  # "laptop" or "mobile"
    lat: float
    lng: float
    accuracy: Optional[float] = 10.0
    battery: Optional[int] = 100
    is_charging: Optional[bool] = False
    speed: Optional[float] = 0.0
    heading: Optional[float] = None
    altitude: Optional[float] = None

class DeviceAction(BaseModel):
    action: str  # "siren", "strobe", "leash", "lock", "ping"
    value: Optional[bool] = None

class GeofenceConfig(BaseModel):
    center_lat: float
    center_lng: float
    radius_meters: float
    name: Optional[str] = "Safe Zone"
    enabled: bool = True

# In-memory fleet registry
devices_registry: Dict[str, Dict[str, Any]] = {}
breadcrumbs_history: List[Dict[str, Any]] = []
geofence_state: Dict[str, Any] = {
    "enabled": True,
    "name": "Base Headquarters",
    "center_lat": 23.0276,
    "center_lng": 72.5871,
    "radius_meters": 500.0,
    "breached": False
}

def init_default_fleet():
    laptop_loc = geolocation_service.get_laptop_location()
    base_lat = laptop_loc.get("lat", 23.0276)
    base_lng = laptop_loc.get("lng", 72.5871)

    # Seed laptop
    devices_registry["laptop-host"] = {
        "id": "laptop-host",
        "name": "Kali Tactical Laptop",
        "model": "ThinkPad Kali-Linux 2026",
        "role": "laptop",
        "lat": base_lat,
        "lng": base_lng,
        "accuracy": 15.0,
        "battery": 88,
        "is_charging": True,
        "speed": 0.0,
        "heading": 0.0,
        "status": "online",
        "last_seen": time.time(),
        "siren_active": False,
        "strobe_active": False,
        "leash_active": True,
        "leash_radius": 100.0,
        "address": laptop_loc.get("address", "Ahmedabad, Gujarat, India")
    }

    # Seed Realistic Fleet Phones ("Anyone Data" out-of-the-box)
    devices_registry["phone-alpha-01"] = {
        "id": "phone-alpha-01",
        "name": "Pixel-Node 01 (Primary)",
        "model": "Google Pixel 8 Pro",
        "role": "mobile",
        "lat": base_lat + 0.0012,
        "lng": base_lng + 0.0008,
        "accuracy": 4.2,
        "battery": 94,
        "is_charging": False,
        "speed": 1.4,
        "heading": 42.0,
        "status": "online",
        "last_seen": time.time() - 3,
        "siren_active": False,
        "strobe_active": False,
        "leash_active": True,
        "leash_radius": 50.0,
        "address": f"Near {laptop_loc.get('city', 'Base')}"
    }

    devices_registry["phone-field-02"] = {
        "id": "phone-field-02",
        "name": "Galaxy-Field 02",
        "model": "Samsung Galaxy S24 Ultra",
        "role": "mobile",
        "lat": base_lat - 0.0028,
        "lng": base_lng + 0.0031,
        "accuracy": 7.8,
        "battery": 67,
        "is_charging": False,
        "speed": 0.0,
        "heading": 180.0,
        "status": "online",
        "last_seen": time.time() - 15,
        "siren_active": False,
        "strobe_active": False,
        "leash_active": False,
        "leash_radius": 150.0,
        "address": f"Sector 4, {laptop_loc.get('city', 'Base')}"
    }

    devices_registry["phone-recon-03"] = {
        "id": "phone-recon-03",
        "name": "OnePlus-Recon 03",
        "model": "OnePlus 12 Tactical",
        "role": "mobile",
        "lat": base_lat + 0.0055,
        "lng": base_lng - 0.0042,
        "accuracy": 12.0,
        "battery": 41,
        "is_charging": True,
        "speed": 18.5,
        "heading": 290.0,
        "status": "online",
        "last_seen": time.time() - 45,
        "siren_active": False,
        "strobe_active": False,
        "leash_active": True,
        "leash_radius": 300.0,
        "address": f"Outer Ring Road, {laptop_loc.get('city', 'Base')}"
    }

init_default_fleet()

@router.get("/fleet")
async def get_fleet_telemetry():
    now = time.time()
    
    # Update laptop location fresh if needed
    laptop = devices_registry.get("laptop-host")
    if laptop:
        loc = geolocation_service.get_laptop_location()
        laptop["lat"] = loc["lat"]
        laptop["lng"] = loc["lng"]
        laptop["address"] = loc["address"]
        laptop["last_seen"] = now

    device_list = []
    for d in devices_registry.values():
        # Set status based on last_seen
        diff = now - d["last_seen"]
        if diff < 60:
            d["status"] = "online"
        elif diff < 300:
            d["status"] = "idle"
        else:
            d["status"] = "offline"
        device_list.append(d)

    return {
        "success": True,
        "total": len(device_list),
        "online_count": sum(1 for d in device_list if d["status"] == "online"),
        "devices": device_list,
        "geofence": geofence_state,
        "server_time": now
    }

@router.post("/device/update")
async def update_device_location(update: DeviceUpdate):
    now = time.time()
    dev_id = update.device_id
    
    device = devices_registry.get(dev_id, {
        "id": dev_id,
        "name": update.name or f"Device {dev_id[:6]}",
        "model": update.model or "Android Smartphone",
        "role": update.role or "mobile",
        "siren_active": False,
        "strobe_active": False,
        "leash_active": True,
        "leash_radius": 100.0
    })

    if update.name:
        device["name"] = update.name
    if update.model:
        device["model"] = update.model
    if update.role:
        device["role"] = update.role

    device["lat"] = update.lat
    device["lng"] = update.lng
    device["accuracy"] = update.accuracy or 10.0
    if update.battery is not None:
        device["battery"] = update.battery
    if update.is_charging is not None:
        device["is_charging"] = update.is_charging
    if update.speed is not None:
        device["speed"] = update.speed
    if update.heading is not None:
        device["heading"] = update.heading
    if update.altitude is not None:
        device["altitude"] = update.altitude
    device["last_seen"] = now
    device["status"] = "online"

    devices_registry[dev_id] = device

    # Append to breadcrumbs trail (cap at 200 items)
    breadcrumbs_history.append({
        "device_id": dev_id,
        "lat": update.lat,
        "lng": update.lng,
        "speed": update.speed,
        "timestamp": now
    })
    if len(breadcrumbs_history) > 200:
        breadcrumbs_history.pop(0)

    return {"success": True, "device": device}

@router.post("/device/{device_id}/action")
async def execute_device_action(device_id: str, act: DeviceAction):
    device = devices_registry.get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found in registry")

    action = act.action.lower()
    if action == "siren":
        new_val = not device.get("siren_active", False) if act.value is None else act.value
        device["siren_active"] = new_val
        # If targeting laptop, play audio alert
        if device.get("role") == "laptop":
            try:
                if new_val:
                    subprocess.Popen(["spd-say", "-r", "10", "ALERT: Tactical Emergency Siren Beacon Triggered"], stderr=subprocess.DEVNULL)
            except Exception:
                pass
        return {"success": True, "action": "siren", "device_id": device_id, "active": new_val}

    elif action == "strobe":
        new_val = not device.get("strobe_active", False) if act.value is None else act.value
        device["strobe_active"] = new_val
        return {"success": True, "action": "strobe", "device_id": device_id, "active": new_val}

    elif action == "leash":
        new_val = not device.get("leash_active", False) if act.value is None else act.value
        device["leash_active"] = new_val
        return {"success": True, "action": "leash", "device_id": device_id, "active": new_val}

    elif action == "lock":
        if device.get("role") == "laptop":
            try:
                subprocess.run(["xflock4"], timeout=2)
            except Exception:
                pass
        return {"success": True, "action": "lock", "device_id": device_id}

    return {"success": False, "message": f"Unknown action {act.action}"}

@router.get("/proximity")
async def get_proximity_matrix():
    laptop = devices_registry.get("laptop-host")
    if not laptop:
        return {"success": False, "error": "Laptop host not registered"}

    host_lat = laptop["lat"]
    host_lng = laptop["lng"]

    matrix = []
    broken_leashes = []

    for dev in devices_registry.values():
        if dev["id"] == "laptop-host":
            continue
        
        dist = geolocation_service.haversine_distance(host_lat, host_lng, dev["lat"], dev["lng"])
        bearing = geolocation_service.calculate_bearing(host_lat, host_lng, dev["lat"], dev["lng"])
        
        is_leashed = dev.get("leash_active", False)
        leash_limit = dev.get("leash_radius", 100.0)
        leash_broken = is_leashed and (dist > leash_limit)

        if leash_broken:
            broken_leashes.append({
                "device_id": dev["id"],
                "device_name": dev["name"],
                "distance": dist,
                "limit": leash_limit
            })

        matrix.append({
            "target_id": dev["id"],
            "target_name": dev["name"],
            "model": dev["model"],
            "distance_meters": dist,
            "bearing_degrees": bearing,
            "battery": dev["battery"],
            "leash_active": is_leashed,
            "leash_radius": leash_limit,
            "leash_broken": leash_broken
        })

    # Sort nearest first
    matrix.sort(key=lambda x: x["distance_meters"])

    return {
        "success": True,
        "host_id": "laptop-host",
        "matrix": matrix,
        "broken_leashes": broken_leashes,
        "nearest": matrix[0] if matrix else None
    }

@router.get("/history")
async def get_tracking_history():
    return {
        "success": True,
        "count": len(breadcrumbs_history),
        "history": breadcrumbs_history
    }

@router.post("/geofence")
async def update_geofence(geo: GeofenceConfig):
    global geofence_state
    geofence_state = {
        "enabled": geo.enabled,
        "name": geo.name or "Safe Zone",
        "center_lat": geo.center_lat,
        "center_lng": geo.center_lng,
        "radius_meters": geo.radius_meters,
        "breached": False
    }
    return {"success": True, "geofence": geofence_state}

@router.get("/geofence")
async def get_geofence():
    return {"success": True, "geofence": geofence_state}
