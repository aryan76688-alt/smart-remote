import time
import os
import json
import subprocess
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services.geolocation_service import geolocation_service
from app.services.intercom_service import intercom_service
from app.database import SessionLocal
from app.models.entities import FleetDeviceEntity, LocationBreadcrumbEntity

router = APIRouter(prefix="/tracking", tags=["tracking"])

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
    action: str  # "siren", "strobe", "leash", "lock", "camera", "mic", "ping"
    value: Optional[bool] = None

class GeofenceConfig(BaseModel):
    center_lat: float
    center_lng: float
    radius_meters: float
    name: Optional[str] = "Safe Zone"
    enabled: bool = True

# In-memory fast cache
devices_registry: Dict[str, Dict[str, Any]] = {}
breadcrumbs_history: List[Dict[str, Any]] = []
geofence_state: Dict[str, Any] = {
    "enabled": True,
    "name": "Dahegam Operations HQ",
    "center_lat": 23.168191,
    "center_lng": 72.822328,
    "radius_meters": 500.0,
    "breached": False
}

def entity_to_dict(entity: FleetDeviceEntity) -> Dict[str, Any]:
    return {
        "id": entity.id,
        "name": entity.name,
        "model": entity.model or "",
        "role": entity.role,
        "lat": entity.lat,
        "lng": entity.lng,
        "accuracy": entity.accuracy or 10.0,
        "battery": entity.battery or 100,
        "is_charging": bool(entity.is_charging),
        "speed": entity.speed or 0.0,
        "heading": entity.heading or 0.0,
        "altitude": entity.altitude or 0.0,
        "status": entity.status or "online",
        "last_seen": entity.last_seen or time.time(),
        "siren_active": bool(entity.siren_active),
        "strobe_active": bool(entity.strobe_active),
        "leash_active": bool(entity.leash_active),
        "leash_radius": entity.leash_radius or 100.0,
        "address": entity.address or "Dahegam, Gandhinagar, Gujarat, India",
        "camera_active": bool(entity.camera_active),
        "mic_active": bool(entity.mic_active)
    }

def init_default_fleet():
    """Initializes database and purges all mock devices so only Kali and Oppo exist."""
    db = SessionLocal()
    try:
        # 1. PURGE any legacy / mock devices from database
        db.query(FleetDeviceEntity).filter(~FleetDeviceEntity.id.in_(["laptop-host", "oppo"])).delete(synchronize_session=False)
        db.commit()

        base_lat = 23.168191
        base_lng = 72.822328
        base_addr = "Dahegam, Gandhinagar, Gujarat, India"

        # 2. Ensure laptop-host (Kali Tactical Laptop) exists in DB
        kali = db.query(FleetDeviceEntity).filter(FleetDeviceEntity.id == "laptop-host").first()
        if not kali:
            kali = FleetDeviceEntity(
                id="laptop-host",
                name="Kali Tactical Laptop",
                model="ThinkPad Kali-Linux Rolling",
                role="laptop",
                lat=base_lat,
                lng=base_lng,
                accuracy=10.0,
                battery=88,
                is_charging=True,
                speed=0.0,
                heading=0.0,
                status="online",
                last_seen=time.time(),
                siren_active=False,
                strobe_active=False,
                leash_active=True,
                leash_radius=100.0,
                address=base_addr,
                camera_active=False,
                mic_active=False
            )
            db.add(kali)
            db.commit()
            db.refresh(kali)
        else:
            # Pin to Dahegam
            kali.lat = base_lat
            kali.lng = base_lng
            kali.address = base_addr
            kali.name = "Kali Tactical Laptop"
            db.commit()

        # 3. Ensure oppo (Oppo Mobile Phone) exists in DB
        oppo = db.query(FleetDeviceEntity).filter(FleetDeviceEntity.id == "oppo").first()
        if not oppo:
            oppo = FleetDeviceEntity(
                id="oppo",
                name="Oppo Mobile Phone",
                model="Oppo Android Fleet Node",
                role="mobile",
                lat=base_lat,
                lng=base_lng,
                accuracy=8.0,
                battery=95,
                is_charging=False,
                speed=0.0,
                heading=0.0,
                status="online",
                last_seen=time.time(),
                siren_active=False,
                strobe_active=False,
                leash_active=True,
                leash_radius=100.0,
                address=base_addr,
                camera_active=False,
                mic_active=False
            )
            db.add(oppo)
            db.commit()
            db.refresh(oppo)

        # 4. Populate memory registry exclusively with Kali and Oppo
        devices_registry.clear()
        devices_registry["laptop-host"] = entity_to_dict(kali)
        devices_registry["oppo"] = entity_to_dict(oppo)

        # Clean old breadcrumbs
        db.query(LocationBreadcrumbEntity).filter(~LocationBreadcrumbEntity.device_id.in_(["laptop-host", "oppo"])).delete(synchronize_session=False)
        db.commit()

    except Exception as e:
        print(f"[TRACKING-DB] Error initializing fleet in DB: {e}")
        db.rollback()
    finally:
        db.close()

init_default_fleet()

@router.get("/fleet")
async def get_fleet_telemetry():
    now = time.time()
    db = SessionLocal()
    try:
        entities = db.query(FleetDeviceEntity).filter(FleetDeviceEntity.id.in_(["laptop-host", "oppo"])).all()
        device_list = []
        for ent in entities:
            d = entity_to_dict(ent)
            diff = now - (d["last_seen"] or 0)
            if diff < 60:
                d["status"] = "online"
            elif diff < 300:
                d["status"] = "idle"
            else:
                d["status"] = "offline"
            device_list.append(d)
            devices_registry[ent.id] = d

        return {
            "success": True,
            "total": len(device_list),
            "online_count": sum(1 for d in device_list if d["status"] == "online"),
            "devices": device_list,
            "geofence": geofence_state,
            "server_time": now
        }
    finally:
        db.close()

@router.post("/device/update")
async def update_device_location(update: DeviceUpdate):
    now = time.time()
    raw_id = update.device_id
    # Always normalize mobile fleet phone to "oppo" unless it's laptop-host
    target_id = "laptop-host" if raw_id == "laptop-host" else "oppo"

    lat = update.lat
    lng = update.lng
    # Detect Reliance Jio / Gujarat cellular tower ISP Gateway in Ahmedabad
    if 23.00 <= lat <= 23.09 and 72.50 <= lng <= 72.63:
        lat = 23.168191
        lng = 72.822328
        addr = "Atul Society, Dahegam, Dehgam Taluka, Gandhinagar"
    else:
        addr = geolocation_service.reverse_geocode(lat, lng)

    db = SessionLocal()
    try:
        device_ent = db.query(FleetDeviceEntity).filter(FleetDeviceEntity.id == target_id).first()
        if not device_ent:
            device_ent = FleetDeviceEntity(
                id=target_id,
                name="Oppo Mobile Phone" if target_id == "oppo" else "Kali Tactical Laptop",
                model=update.model or ("Oppo Smartphone" if target_id == "oppo" else "Kali Host"),
                role="mobile" if target_id == "oppo" else "laptop",
                lat=lat,
                lng=lng,
                accuracy=update.accuracy or 10.0,
                battery=update.battery or 100,
                is_charging=update.is_charging or False,
                speed=update.speed or 0.0,
                heading=update.heading or 0.0,
                altitude=update.altitude or 0.0,
                status="online",
                last_seen=now,
                siren_active=False,
                strobe_active=False,
                leash_active=True,
                leash_radius=100.0,
                address=addr
            )
            db.add(device_ent)
        else:
            if update.name and update.name.strip():
                device_ent.name = update.name.strip()
            if update.model:
                device_ent.model = update.model
            device_ent.lat = lat
            device_ent.lng = lng
            device_ent.address = addr
            if update.accuracy is not None:
                device_ent.accuracy = update.accuracy
            if update.battery is not None:
                device_ent.battery = update.battery
            if update.is_charging is not None:
                device_ent.is_charging = update.is_charging
            if update.speed is not None:
                device_ent.speed = update.speed
            if update.heading is not None:
                device_ent.heading = update.heading
            if update.altitude is not None:
                device_ent.altitude = update.altitude
            device_ent.last_seen = now
            device_ent.status = "online"

        db.commit()
        db.refresh(device_ent)

        d_dict = entity_to_dict(device_ent)
        devices_registry[target_id] = d_dict

        # Log breadcrumb
        breadcrumb = LocationBreadcrumbEntity(
            device_id=target_id,
            lat=update.lat,
            lng=update.lng,
            speed=update.speed or 0.0,
            timestamp=now
        )
        db.add(breadcrumb)
        db.commit()

        # Update in-memory trail
        breadcrumbs_history.append({
            "device_id": target_id,
            "lat": update.lat,
            "lng": update.lng,
            "speed": update.speed or 0.0,
            "timestamp": now
        })
        if len(breadcrumbs_history) > 200:
            breadcrumbs_history.pop(0)

        return {
            "success": True,
            "device": d_dict,
            "actions": {
                "siren": bool(device_ent.siren_active),
                "strobe": bool(device_ent.strobe_active),
                "camera": bool(device_ent.camera_active),
                "mic": bool(device_ent.mic_active),
                "mirror": bool(devices_registry.get(target_id, {}).get("mirror_active", False))
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update error: {str(e)}")
    finally:
        db.close()

@router.post("/device/{device_id}/action")
async def execute_device_action(device_id: str, act: DeviceAction):
    # Normalize ID to either laptop-host or oppo
    target_id = "laptop-host" if device_id == "laptop-host" else "oppo"
    db = SessionLocal()
    try:
        device_ent = db.query(FleetDeviceEntity).filter(FleetDeviceEntity.id == target_id).first()
        if not device_ent:
            raise HTTPException(status_code=404, detail="Device not found in database")

        action = act.action.lower()
        if action == "siren":
            new_val = not bool(device_ent.siren_active) if act.value is None else act.value
            device_ent.siren_active = new_val
            db.commit()
            devices_registry[target_id]["siren_active"] = new_val

            # Blast physical siren on laptop speakers
            if new_val:
                intercom_service.start_emergency_siren(duration_sec=30)
            else:
                intercom_service.stop_emergency_siren()

            return {"success": True, "action": "siren", "device_id": target_id, "active": new_val}

        elif action == "strobe":
            new_val = not bool(device_ent.strobe_active) if act.value is None else act.value
            device_ent.strobe_active = new_val
            db.commit()
            devices_registry[target_id]["strobe_active"] = new_val
            return {"success": True, "action": "strobe", "device_id": target_id, "active": new_val}

        elif action == "camera":
            new_val = not bool(device_ent.camera_active) if act.value is None else act.value
            device_ent.camera_active = new_val
            db.commit()
            devices_registry[target_id]["camera_active"] = new_val
            return {"success": True, "action": "camera", "device_id": target_id, "active": new_val}

        elif action == "mic":
            new_val = not bool(device_ent.mic_active) if act.value is None else act.value
            device_ent.mic_active = new_val
            db.commit()
            devices_registry[target_id]["mic_active"] = new_val
            return {"success": True, "action": "mic", "device_id": target_id, "active": new_val}

        elif action == "mirror":
            cur_mirror = bool(devices_registry.get(target_id, {}).get("mirror_active", False))
            new_val = not cur_mirror if act.value is None else act.value
            devices_registry[target_id]["mirror_active"] = new_val
            try:
                import app.api.remote as remote_mod
                remote_mod._mobile_mirror_requested = new_val
            except Exception:
                pass
            return {"success": True, "action": "mirror", "device_id": target_id, "active": new_val}

        elif action == "leash":
            new_val = not bool(device_ent.leash_active) if act.value is None else act.value
            device_ent.leash_active = new_val
            db.commit()
            devices_registry[target_id]["leash_active"] = new_val
            return {"success": True, "action": "leash", "device_id": target_id, "active": new_val}

        elif action == "lock":
            if target_id == "laptop-host":
                try:
                    subprocess.run(["xflock4"], timeout=2)
                except Exception:
                    pass
            return {"success": True, "action": "lock", "device_id": target_id}

        return {"success": False, "message": f"Unknown action {act.action}"}
    finally:
        db.close()

@router.get("/proximity")
async def get_proximity_matrix():
    laptop = devices_registry.get("laptop-host")
    oppo = devices_registry.get("oppo")
    if not laptop or not oppo:
        return {"success": False, "error": "Devices not ready"}

    host_lat = laptop["lat"]
    host_lng = laptop["lng"]

    dist = geolocation_service.haversine_distance(host_lat, host_lng, oppo["lat"], oppo["lng"])
    bearing = geolocation_service.calculate_bearing(host_lat, host_lng, oppo["lat"], oppo["lng"])
    is_leashed = oppo.get("leash_active", False)
    leash_limit = oppo.get("leash_radius", 100.0)
    leash_broken = is_leashed and (dist > leash_limit)

    matrix = [{
        "target_id": "oppo",
        "target_name": oppo.get("name", "Oppo Mobile Phone"),
        "model": oppo.get("model", "Oppo Smartphone"),
        "distance_meters": dist,
        "bearing_degrees": bearing,
        "battery": oppo.get("battery", 100),
        "leash_active": is_leashed,
        "leash_radius": leash_limit,
        "leash_broken": leash_broken
    }]

    broken_leashes = []
    if leash_broken:
        broken_leashes.append({
            "device_id": "oppo",
            "device_name": oppo.get("name", "Oppo Mobile Phone"),
            "distance": dist,
            "limit": leash_limit
        })

    return {
        "success": True,
        "host_id": "laptop-host",
        "matrix": matrix,
        "broken_leashes": broken_leashes,
        "nearest": matrix[0]
    }

@router.get("/history")
async def get_tracking_history():
    db = SessionLocal()
    try:
        crumbs = db.query(LocationBreadcrumbEntity).order_by(LocationBreadcrumbEntity.timestamp.desc()).limit(100).all()
        return {
            "success": True,
            "count": len(crumbs),
            "history": [
                {
                    "device_id": c.device_id,
                    "lat": c.lat,
                    "lng": c.lng,
                    "speed": c.speed,
                    "timestamp": c.timestamp
                }
                for c in reversed(crumbs)
            ]
        }
    finally:
        db.close()

@router.post("/geofence")
async def update_geofence(geo: GeofenceConfig):
    global geofence_state
    geofence_state = {
        "enabled": geo.enabled,
        "name": geo.name or "Dahegam Operations HQ",
        "center_lat": geo.center_lat,
        "center_lng": geo.center_lng,
        "radius_meters": geo.radius_meters,
        "breached": False
    }
    return {"success": True, "geofence": geofence_state}

@router.get("/geofence")
async def get_geofence():
    return {"success": True, "geofence": geofence_state}
