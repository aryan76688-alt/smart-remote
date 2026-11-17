import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from ..core.config import settings

router = APIRouter(prefix="/api/maps", tags=["Google Maps & Geolocation"])

# In-RAM location telemetry
current_device_location = {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "accuracy_m": 8.5,
    "altitude_m": 216.0,
    "speed_mps": 0.0,
    "heading_deg": 0.0,
    "last_updated": time.time(),
    "geofence_status": "INSIDE_HOME_ZONE",
    "home_latitude": 28.6139,
    "home_longitude": 77.2090,
    "radius_m": 50.0
}

# In-memory breadcrumb trail
location_breadcrumbs: List[dict] = []

class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = 10.0
    altitude: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None

class GeofenceConfigRequest(BaseModel):
    home_latitude: float
    home_longitude: float
    radius_m: float = 50.0

@router.get("/config")
def get_maps_config():
    """Provides client with map settings and Google Maps loader information."""
    return {
        "success": True,
        "api_key": settings.GOOGLE_MAPS_API_KEY,
        "default_center": {
            "lat": current_device_location["latitude"],
            "lng": current_device_location["longitude"]
        },
        "default_zoom": 17,
        "map_type": "hybrid"
    }

@router.get("/location")
def get_device_location():
    """Returns real-time GPS telemetry for the Google Maps marker."""
    return {
        "success": True,
        "location": current_device_location,
        "breadcrumbs_count": len(location_breadcrumbs)
    }

@router.post("/update")
def update_device_location(req: LocationUpdateRequest):
    global current_device_location, location_breadcrumbs

    current_device_location["latitude"] = req.latitude
    current_device_location["longitude"] = req.longitude
    current_device_location["accuracy_m"] = req.accuracy or 10.0
    current_device_location["altitude_m"] = req.altitude or 0.0
    current_device_location["speed_mps"] = req.speed or 0.0
    current_device_location["heading_deg"] = req.heading or 0.0
    current_device_location["last_updated"] = time.time()

    # Calculate distance from home
    from math import radians, cos, sin, asin, sqrt
    def haversine(lon1, lat1, lon2, lat2):
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371000  # meters
        return c * r

    dist = haversine(
        req.longitude, req.latitude,
        current_device_location["home_longitude"], current_device_location["home_latitude"]
    )

    current_device_location["distance_from_home_m"] = round(dist, 1)
    if dist > current_device_location["radius_m"]:
        current_device_location["geofence_status"] = "OUTSIDE_PERIMETER"
    else:
        current_device_location["geofence_status"] = "INSIDE_HOME_ZONE"

    # Store breadcrumb (max 100 in RAM)
    location_breadcrumbs.append({
        "lat": req.latitude,
        "lng": req.longitude,
        "time": time.time()
    })
    if len(location_breadcrumbs) > 100:
        location_breadcrumbs.pop(0)

    return {
        "success": True,
        "geofence_status": current_device_location["geofence_status"],
        "distance_m": current_device_location["distance_from_home_m"]
    }

@router.get("/breadcrumbs")
def get_breadcrumbs():
    return {"success": True, "breadcrumbs": location_breadcrumbs}

@router.post("/geofence")
def set_geofence(req: GeofenceConfigRequest):
    current_device_location["home_latitude"] = req.home_latitude
    current_device_location["home_longitude"] = req.home_longitude
    current_device_location["radius_m"] = req.radius_m
    return {"success": True, "message": "Geofence perimeter updated"}
