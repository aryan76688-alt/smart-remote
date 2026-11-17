import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ShieldCheck, Compass, Crosshair, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import L from 'leaflet';

export const GoogleMapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [location, setLocation] = useState<any>({
    latitude: 28.6139,
    longitude: 77.2090,
    accuracy_m: 8.0,
    altitude_m: 216.0,
    speed_mps: 0.0,
    geofence_status: 'INSIDE_HOME_ZONE',
    distance_from_home_m: 0.0
  });

  const [tracking, setTracking] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([location.latitude, location.longitude], 16);

    // Google-style clean tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Custom Blue Pulsing Marker for Device
    const customIcon = L.divIcon({
      className: 'custom-gps-pin',
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(0, 122, 255, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 20px; height: 20px; border-radius: 9999px; background: #007AFF; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([location.latitude, location.longitude], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    // Home Geofence Circle
    const circle = L.circle([location.latitude, location.longitude], {
      color: '#34C759',
      fillColor: '#34C759',
      fillOpacity: 0.12,
      radius: 50
    }).addTo(map);
    circleRef.current = circle;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Live Location Watcher
  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude || 0,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || 0
        };

        setLocation((prev: any) => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_m: coords.accuracy,
          altitude_m: coords.altitude,
          speed_mps: coords.speed
        }));

        // Send to backend
        try {
          const res = await api.updateLocation(coords);
          if (res.success) {
            setLocation((prev: any) => ({
              ...prev,
              geofence_status: res.geofence_status,
              distance_from_home_m: res.distance_m
            }));
          }
        } catch (e) {
          // keep local
        }

        // Update Map Marker
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([coords.latitude, coords.longitude]);
        }
      },
      (err) => console.log('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [tracking]);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([location.latitude, location.longitude], 17);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Top Telemetry Header */}
      <div className="flex items-center justify-between glass-panel p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-apple-blue" />
          <div>
            <h3 className="text-xs font-bold text-slate-800">Google Maps Live GPS</h3>
            <span className="text-[10px] text-slate-500 font-mono">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
            location.geofence_status === 'INSIDE_HOME_ZONE'
              ? 'bg-apple-green/10 text-apple-green border border-apple-green/30'
              : 'bg-apple-red/10 text-apple-red border border-apple-red/30'
          }`}>
            <ShieldCheck size={12} />
            <span>{location.geofence_status === 'INSIDE_HOME_ZONE' ? 'Home Perimeter' : 'Outside Zone'}</span>
          </span>
          <button
            onClick={recenterMap}
            className="p-2 bg-slate-200/60 rounded-xl text-slate-700 active:scale-95 transition-all"
            title="Recenter Map"
          >
            <Crosshair size={14} />
          </button>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="flex-1 glass-panel rounded-3xl overflow-hidden relative shadow-md border border-white/80">
        <div ref={mapContainerRef} className="w-full h-full z-0"></div>

        {/* Floating Telemetry Badge */}
        <div className="absolute bottom-4 left-4 right-4 z-10 glass-dark text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Distance</span>
              <span className="block text-sm font-bold font-mono text-apple-blue">
                {location.distance_from_home_m || 0} m
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/20"></div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Speed</span>
              <span className="block text-sm font-bold font-mono text-apple-green">
                {(location.speed_mps * 3.6).toFixed(1)} km/h
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/20"></div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Altitude</span>
              <span className="block text-sm font-bold font-mono text-apple-purple">
                {location.altitude_m?.toFixed(0) || 0} m
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse"></span>
            <span>Real-time GPS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
