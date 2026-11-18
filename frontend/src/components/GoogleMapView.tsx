import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ShieldCheck, Crosshair, Layers, Volume2, Flashlight } from 'lucide-react';
import { api } from '../services/api';
import L from 'leaflet';

type MapLayerMode = 'roadmap' | 'hybrid' | 'satellite';

const GOOGLE_TILE_URLS: Record<MapLayerMode, string> = {
  roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  hybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
};

export const GoogleMapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [layerMode, setLayerMode] = useState<MapLayerMode>('hybrid');
  const [sirenActive, setSirenActive] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [location, setLocation] = useState<any>({
    latitude: 28.6139,
    longitude: 77.2090,
    accuracy_m: 8.0,
    altitude_m: 216.0,
    speed_mps: 0.0,
    geofence_status: 'INSIDE_HOME_ZONE',
    distance_from_home_m: 0.0
  });

  // Initialize Real Google Maps Tile Canvas
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([location.latitude, location.longitude], 17);

    const tiles = L.tileLayer(GOOGLE_TILE_URLS[layerMode], {
      maxZoom: 21,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);
    tileLayerRef.current = tiles;

    const customIcon = L.divIcon({
      className: 'custom-gps-pin',
      html: `
        <div style="position: relative; width: 26px; height: 26px;">
          <div style="position: absolute; inset: -6px; border-radius: 9999px; background: rgba(0, 122, 255, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 22px; height: 22px; border-radius: 9999px; background: #007AFF; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const marker = L.marker([location.latitude, location.longitude], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    const circle = L.circle([location.latitude, location.longitude], {
      color: '#34C759',
      fillColor: '#34C759',
      fillOpacity: 0.14,
      radius: 50
    }).addTo(map);
    circleRef.current = circle;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Google Map layer dynamically (Roadmap / Hybrid / Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(GOOGLE_TILE_URLS[layerMode], {
      maxZoom: 21
    }).addTo(mapInstanceRef.current);
  }, [layerMode]);

  // Poll backend for live phone companion GPS updates
  useEffect(() => {
    const fetchLiveLocation = async () => {
      try {
        const res = await api.getDeviceLocation();
        if (res.success && res.location) {
          const loc = res.location;
          setLocation(loc);
          if (markerRef.current && circleRef.current) {
            markerRef.current.setLatLng([loc.latitude, loc.longitude]);
            circleRef.current.setLatLng([loc.home_latitude || loc.latitude, loc.home_longitude || loc.longitude]);
          }
        }
      } catch (_e) {}
    };
    fetchLiveLocation();
    const timer = setInterval(fetchLiveLocation, 3000);
    return () => clearInterval(timer);
  }, []);

  // Also stream browser geolocation if available
  useEffect(() => {
    if (!navigator.geolocation) return;
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
        try {
          await api.updateLocation(coords);
        } catch (_e) {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const recenterMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([location.latitude, location.longitude], 18);
    }
  };

  const cycleLayer = () => {
    setLayerMode((prev) => (prev === 'hybrid' ? 'roadmap' : prev === 'roadmap' ? 'satellite' : 'hybrid'));
  };

  const togglePhoneSiren = async () => {
    const next = !sirenActive;
    setSirenActive(next);
    await fetch(`${window.location.origin}/api/phone/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siren: next })
    });
  };

  const togglePhoneTorch = async () => {
    const next = !torchActive;
    setTorchActive(next);
    await fetch(`${window.location.origin}/api/phone/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strobe: next })
    });
  };

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Top Google Maps Telemetry Header */}
      <div className="flex items-center justify-between glass-panel p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-apple-blue" />
          <div>
            <h3 className="text-xs font-bold text-slate-800">Google Maps Live GPS ({layerMode.toUpperCase()})</h3>
            <span className="text-[10px] text-slate-500 font-mono">
              {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={cycleLayer}
            className="p-2 bg-slate-200/70 rounded-xl text-slate-700 active:scale-95 transition-all"
            title="Switch Google Maps Layer"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={togglePhoneSiren}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              sirenActive ? 'bg-apple-red text-white animate-pulse shadow-md' : 'bg-slate-200/70 text-slate-700'
            }`}
            title="110dB Emergency Phone Siren"
          >
            <Volume2 size={14} />
          </button>
          <button
            onClick={togglePhoneTorch}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              torchActive ? 'bg-apple-orange text-white shadow-md' : 'bg-slate-200/70 text-slate-700'
            }`}
            title="Remote Phone Flashlight"
          >
            <Flashlight size={14} />
          </button>
          <button
            onClick={recenterMap}
            className="p-2 bg-apple-blue text-white rounded-xl active:scale-95 transition-all shadow-sm"
            title="Recenter on Device"
          >
            <Crosshair size={14} />
          </button>
        </div>
      </div>

      {/* Main Google Maps Canvas */}
      <div className="flex-1 glass-panel rounded-3xl overflow-hidden relative shadow-md border border-white/80">
        <div ref={mapContainerRef} className="w-full h-full z-0"></div>

        {/* Geofence Status Pill */}
        <div className="absolute top-3 left-3 z-10">
          <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 backdrop-blur-md shadow-md ${
            location.geofence_status === 'INSIDE_HOME_ZONE'
              ? 'bg-black/65 text-apple-green border border-apple-green/40'
              : 'bg-black/65 text-apple-red border border-apple-red/40'
          }`}>
            <ShieldCheck size={12} />
            <span>{location.geofence_status === 'INSIDE_HOME_ZONE' ? 'Home Perimeter Safe' : 'Outside Geofence'}</span>
          </span>
        </div>

        {/* Floating Telemetry Badge */}
        <div className="absolute bottom-3 left-3 right-3 z-10 glass-dark text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xl border border-white/10">
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
                {((location.speed_mps || 0) * 3.6).toFixed(1)} km/h
              </span>
            </div>
            <div className="h-6 w-[1px] bg-white/20"></div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Accuracy</span>
              <span className="block text-sm font-bold font-mono text-apple-purple">
                ±{Math.round(location.accuracy_m || 10)} m
              </span>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-apple-blue rounded-xl text-[11px] font-bold text-white shadow-sm active:scale-95"
          >
            Open Maps
          </a>
        </div>
      </div>
    </div>
  );
};
