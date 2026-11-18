import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ShieldCheck, Crosshair, Layers, Volume2, Flashlight } from 'lucide-react';
import { api } from '../services/api';
import L from 'leaflet';

type MapLayerMode = 'hybrid' | 'roadmap' | 'satellite';

const GOOGLE_TILE_URLS: Record<MapLayerMode, string> = {
  hybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
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

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([location.latitude, location.longitude], 17);

    const tiles = L.tileLayer(GOOGLE_TILE_URLS[layerMode], { maxZoom: 21 }).addTo(map);
    tileLayerRef.current = tiles;

    const customIcon = L.divIcon({
      className: 'custom-gps-pin',
      html: `
        <div style="position: relative; width: 26px; height: 26px;">
          <div style="position: absolute; inset: -6px; border-radius: 9999px; background: rgba(62, 144, 255, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 22px; height: 22px; border-radius: 9999px; background: #3e90ff; border: 3px solid #ffffff; box-shadow: 0 0 18px rgba(62,144,255,0.9);"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    markerRef.current = L.marker([location.latitude, location.longitude], { icon: customIcon }).addTo(map);
    circleRef.current = L.circle([location.latitude, location.longitude], {
      color: '#47e266',
      fillColor: '#47e266',
      fillOpacity: 0.14,
      radius: 50
    }).addTo(map);

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) mapInstanceRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(GOOGLE_TILE_URLS[layerMode], { maxZoom: 21 }).addTo(mapInstanceRef.current);
  }, [layerMode]);

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

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await api.updateLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude || 0,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0
          });
        } catch (_e) {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const recenterMap = () => {
    mapInstanceRef.current?.flyTo([location.latitude, location.longitude], 18);
  };

  const cycleLayer = () => {
    setLayerMode((prev) => (prev === 'hybrid' ? 'roadmap' : prev === 'roadmap' ? 'satellite' : 'hybrid'));
  };

  const togglePhoneSiren = async () => {
    const next = !sirenActive;
    setSirenActive(next);
    await api.controlPhone({ siren: next });
  };

  const togglePhoneTorch = async () => {
    const next = !torchActive;
    setTorchActive(next);
    await api.controlPhone({ strobe: next });
  };

  return (
    <div className="w-full h-full px-3 pb-4 flex flex-col items-center">
      <div className="w-full max-w-md h-full flex flex-col gap-3">
        {/* Transparent Glass Map Header */}
        <div className="liquid-glass rounded-2xl p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl liquid-glass-deep flex items-center justify-center text-stitch-primary shrink-0">
              <MapPin size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-xs font-bold text-stitch-text truncate">
                Google Maps • {layerMode.toUpperCase()}
              </h3>
              <span className="font-mono text-[10px] text-stitch-muted block truncate">
                {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cycleLayer}
              aria-label="Switch Google Maps layer"
              className="w-9 h-9 rounded-xl liquid-btn flex items-center justify-center text-stitch-text"
            >
              <Layers size={15} />
            </button>
            <button
              type="button"
              onClick={togglePhoneSiren}
              aria-label="Toggle 110dB phone siren"
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                sirenActive
                  ? 'bg-stitch-errorStrong/80 border-stitch-error text-white animate-pulse shadow-[0_0_18px_rgba(255,59,48,0.6)]'
                  : 'liquid-btn text-stitch-error'
              }`}
            >
              <Volume2 size={15} />
            </button>
            <button
              type="button"
              onClick={togglePhoneTorch}
              aria-label="Toggle phone torch"
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                torchActive
                  ? 'bg-amber-500/70 border-amber-300 text-white shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                  : 'liquid-btn text-amber-300'
              }`}
            >
              <Flashlight size={15} />
            </button>
            <button
              type="button"
              onClick={recenterMap}
              aria-label="Recenter map"
              className="w-9 h-9 rounded-xl bg-stitch-primaryStrong/80 text-white flex items-center justify-center shadow-[0_0_14px_rgba(62,144,255,0.5)] active:scale-95"
            >
              <Crosshair size={15} />
            </button>
          </div>
        </div>

        {/* Crystal Framed Google Maps Viewport */}
        <div className="flex-1 liquid-glass rounded-3xl overflow-hidden relative p-1">
          <div ref={mapContainerRef} className="w-full h-full rounded-[20px] z-0 overflow-hidden" />

          {/* Top-Left Geofence Pill */}
          <div className="absolute top-3.5 left-3.5 z-10">
            <span className={`text-[10px] font-mono px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 backdrop-blur-xl border shadow-lg ${
              location.geofence_status === 'INSIDE_HOME_ZONE'
                ? 'bg-black/60 text-stitch-secondary border-stitch-secondary/40'
                : 'bg-black/60 text-stitch-error border-stitch-error/40'
            }`}>
              <ShieldCheck size={12} />
              <span>{location.geofence_status === 'INSIDE_HOME_ZONE' ? 'HOME ZONE SAFE' : 'OUTSIDE ZONE'}</span>
            </span>
          </div>

          {/* Bottom Floating Liquid Glass HUD */}
          <div className="absolute bottom-3.5 left-3.5 right-3.5 z-10 liquid-pill rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div>
                <span className="font-mono text-[9px] text-stitch-muted uppercase block">Distance</span>
                <span className="font-mono text-xs font-bold text-stitch-primary">
                  {location.distance_from_home_m || 0} m
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/15" />
              <div>
                <span className="font-mono text-[9px] text-stitch-muted uppercase block">Speed</span>
                <span className="font-mono text-xs font-bold text-stitch-secondary">
                  {((location.speed_mps || 0) * 3.6).toFixed(1)} km/h
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/15" />
              <div>
                <span className="font-mono text-[9px] text-stitch-muted uppercase block">Acc</span>
                <span className="font-mono text-xs font-bold text-stitch-tertiary">
                  ±{Math.round(location.accuracy_m || 10)}m
                </span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-stitch-primaryStrong/85 text-white text-[11px] font-semibold shadow-[0_0_15px_rgba(62,144,255,0.45)]"
            >
              Open Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
