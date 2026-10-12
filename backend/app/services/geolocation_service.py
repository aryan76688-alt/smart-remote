import math
import subprocess
import json
import urllib.request
import time
from typing import Dict, Any, Optional, Tuple

class GeolocationService:
    def __init__(self):
        # Default cached location (Ahmedabad, India fallback or last known)
        self.cached_location: Dict[str, Any] = {
            "lat": 23.0276,
            "lng": 72.5871,
            "accuracy": 25.0,
            "city": "Ahmedabad",
            "region": "Gujarat",
            "country": "India",
            "address": "Ahmedabad, Gujarat, India",
            "source": "ip_fallback",
            "last_updated": time.time()
        }
        self.cache_ttl = 120  # 2 minutes

    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate the great circle distance between two points in meters."""
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2.0) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 1)

    def calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate initial compass bearing from point 1 to point 2 in degrees (0-360)."""
        y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
        x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
            math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
        initial_bearing = math.atan2(y, x)
        compass_bearing = (math.degrees(initial_bearing) + 360) % 360
        return round(compass_bearing, 1)

    def get_wifi_access_points(self) -> list:
        """Scan surrounding Wi-Fi networks via nmcli to extract BSSIDs and signals."""
        aps = []
        try:
            res = subprocess.run(
                ["nmcli", "-t", "-f", "BSSID,SSID,SIGNAL", "dev", "wifi", "list"],
                capture_output=True,
                text=True,
                timeout=4
            )
            if res.returncode == 0:
                for line in res.stdout.strip().splitlines():
                    parts = line.split(":")
                    if len(parts) >= 7:
                        # BSSID is 6 parts: e.g. AA:BB:CC:DD:EE:FF:SSID:SIGNAL
                        bssid = ":".join(parts[:6]).replace("\\", "")
                        remainder = ":".join(parts[6:])
                        rem_parts = remainder.rsplit(":", 1)
                        ssid = rem_parts[0] if len(rem_parts) > 1 else ""
                        signal = int(rem_parts[1]) if len(rem_parts) > 1 and rem_parts[1].isdigit() else 50
                        aps.append({
                            "macAddress": bssid,
                            "signalStrength": -100 + (signal // 2),  # Approximate dBm
                            "ssid": ssid
                        })
        except Exception:
            pass
        return aps

    def reverse_geocode(self, lat: float, lng: float) -> str:
        """Reverse geocode coordinates into a human readable address."""
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
            req = urllib.request.Request(url, headers={"User-Agent": "SmartRemote-TacticalTracker/2.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                display_name = data.get("display_name", "")
                if display_name:
                    parts = [p.strip() for p in display_name.split(",")[:4]]
                    return ", ".join(parts)
        except Exception:
            pass
        return f"{lat:.4f}°N, {lng:.4f}°E"

    def get_laptop_location(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch laptop's current coordinates via IP or Wi-Fi scan."""
        now = time.time()
        if not force_refresh and (now - self.cached_location["last_updated"] < self.cache_ttl):
            return self.cached_location

        # Try IP Geolocation lookup
        try:
            req = urllib.request.Request("http://ip-api.com/json", headers={"User-Agent": "curl/7.88.1"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == "success":
                    lat = float(data.get("lat", self.cached_location["lat"]))
                    lng = float(data.get("lon", self.cached_location["lng"]))
                    city = data.get("city", "Unknown City")
                    region = data.get("regionName", "")
                    country = data.get("country", "")
                    
                    self.cached_location = {
                        "lat": lat,
                        "lng": lng,
                        "accuracy": 1500.0,
                        "city": city,
                        "region": region,
                        "country": country,
                        "address": f"{city}, {region}, {country}",
                        "source": "ip_geolocation",
                        "isp": data.get("isp", ""),
                        "last_updated": now
                    }
                    return self.cached_location
        except Exception:
            pass

        return self.cached_location

geolocation_service = GeolocationService()
