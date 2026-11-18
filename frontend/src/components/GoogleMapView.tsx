import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Crosshair, Layers, Volume2, Flashlight } from 'lucide-react';
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

  const [layerMode, setLayerMode] = useState<MapLayerMode>('roadmap');
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

    tileLayerRef.current = L.tileLayer(GOOGLE_TILE_URLS[layerMode], { maxZoom: 21 }).addTo(map);

    const customIcon = L.divIcon({
      className: 'custom-gps-pin',
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: absolute; inset: -6px; border-radius: 9999px; background: rgba(0, 102, 204, 0.25); animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 20px; height: 20px; border-radius: 9999px; background: #0066cc; border: 3px solid #ffffff;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    markerRef.current = L.marker([location.latitude, location.longitude], { icon: customIcon }).addTo(map);
    circleRef.current = L.circle([location.latitude, location.longitude], {
      color: '#0066cc',
      fillColor: '#0066cc',
      fillOpacity: 0.1,
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

  const recenterMap = () => mapInstanceRef.current?.flyTo([location.latitude, location.longitude], 18);
  const cycleLayer = () => setLayerMode((prev) => (prev === 'roadmap' ? 'hybrid' : prev === 'hybrid' ? 'satellite' : 'roadmap'));

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
    <div className="w-full h-full px-4 pb-24 pt-1 flex flex-col">
      <div className="max-w-[980px] w-full mx-auto h-full flex flex-col gap-3">
        {/* Header Bar */}
        <div className="apple-glass-card p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="type-caption-strong text-apple-ink truncate">
              Google Maps · {layerMode.charAt(0).toUpperCase() + layerMode.slice(1)}
            </h2>
            <p className="type-fine font-mono text-apple-ink48 truncate">
              {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={togglePhoneSiren}
              className={`px-3.5 py-2 min-h-[40px] type-fine font-semibold flex items-center gap-1.5 ${
                sirenActive ? 'apple-btn-dark' : 'apple-btn-pearl'
              }`}
            >
              <Volume2 size={14} className={sirenActive ? 'text-white' : 'text-apple-primary'} />
              <span>{sirenActive ? 'Stop Siren' : 'Siren'}</span>
            </button>
            <button
              type="button"
              onClick={togglePhoneTorch}
              className={`px-3.5 py-2 min-h-[40px] type-fine font-semibold flex items-center gap-1.5 ${
                torchActive ? 'apple-btn-primary' : 'apple-btn-pearl'
              }`}
            >
              <Flashlight size={14} className={torchActive ? 'text-white' : 'text-apple-primary'} />
              <span>Torch</span>
            </button>
          </div>
        </div>

        {/* Map Stage with Single Product Shadow & Circular Translucent Chips (44x44px) */}
        <div className="flex-1 rounded-apple-lg overflow-hidden relative bg-apple-canvas border border-apple-hairline apple-product-shadow">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Top-Left Geofence Pill */}
          <div className="absolute top-3 left-3 z-10">
            <span className="apple-glass-floating rounded-full px-3.5 py-2 type-fine font-semibold text-apple-ink flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-apple-primary" />
              <span>{location.geofence_status === 'INSIDE_HOME_ZONE' ? 'Home Zone Safe' : 'Outside Perimeter'}</span>
            </span>
          </div>

          {/* Top-Right 44x44px Circular Translucent Map Controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={cycleLayer}
              aria-label="Switch Map Layer"
              className="apple-glass-chip w-[44px] h-[44px] rounded-full flex items-center justify-center"
            >
              <Layers size={18} />
            </button>
            <button
              type="button"
              onClick={recenterMap}
              aria-label="Recenter on Device"
              className="apple-glass-chip w-[44px] h-[44px] rounded-full flex items-center justify-center"
            >
              <Crosshair size={18} />
            </button>
          </div>

          {/* Bottom Floating Liquid Glass Telemetry Bar */}
          <div className="absolute bottom-3 left-3 right-3 z-10 apple-glass-floating rounded-full px-5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="type-micro text-apple-ink48 block">Distance</span>
                <span className="type-caption-strong font-mono text-apple-ink">{location.distance_from_home_m || 0} m</span>
              </div>
              <div className="h-6 w-[1px] bg-apple-hairline" />
              <div>
                <span className="type-micro text-apple-ink48 block">Speed</span>
                <span className="type-caption-strong font-mono text-apple-ink">{((location.speed_mps || 0) * 3.6).toFixed(1)} km/h</span>
              </div>
              <div className="h-6 w-[1px] bg-apple-hairline hidden sm:block" />
              <div className="hidden sm:block">
                <span className="type-micro text-apple-ink48 block">Accuracy</span>
                <span className="type-caption-strong font-mono text-apple-ink">±{Math.round(location.accuracy_m || 10)} m</span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="apple-btn-primary px-4 py-2 type-fine shrink-0"
            >
              Open Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
