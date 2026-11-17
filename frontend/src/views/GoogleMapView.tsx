import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Compass,
  MapPin,
  Smartphone,
  Laptop,
  Volume2,
  VolumeX,
  Flashlight,
  ExternalLink,
  Layers,
  Crosshair,
  RefreshCw,
  Battery,
  BatteryCharging,
  ShieldAlert,
  AlertTriangle,
  LocateFixed,
  Route,
  Activity
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

// Tile URLs for Google Maps layers
const GOOGLE_TILE_LAYERS: Record<string, { name: string; url: string; maxZoom: number }> = {
  roadmap: {
    name: 'Roadmap',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20
  },
  satellite: {
    name: 'Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20
  },
  hybrid: {
    name: 'Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20
  },
  terrain: {
    name: 'Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 20
  }
};

interface FleetDevice {
  id: string;
  name: string;
  model: string;
  role: 'laptop' | 'mobile';
  lat: number;
  lng: number;
  accuracy: number;
  battery: number;
  is_charging: boolean;
  speed: number;
  heading?: number;
  status: 'online' | 'idle' | 'offline';
  last_seen: number;
  siren_active?: boolean;
  strobe_active?: boolean;
  address?: string;
}

export const GoogleMapView: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const circlesRef = useRef<{ [key: string]: L.Circle }>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const leashCircleRef = useRef<L.Circle | null>(null);

  const [activeLayer, setActiveLayer] = useState<string>('hybrid');
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<FleetDevice | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [sirenActive, setSirenActive] = useState<boolean>(false);
  const [strobeActive, setStrobeActive] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Virtual Leash State
  const [leashActive, setLeashActive] = useState<boolean>(true);
  const [leashRadius, setLeashRadius] = useState<number>(100);

  // Haversine distance calculation in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  // Create Custom Apple-Style Marker Icons
  const createDeviceIcon = (device: FleetDevice) => {
    const isPhone = device.role === 'mobile' || device.id === 'oppo';
    const bgGradient = isPhone
      ? 'from-emerald-500 to-green-600 border-white'
      : 'from-blue-500 to-indigo-600 border-white';

    const pulseRing = isPhone
      ? `<span class="absolute -inset-2 rounded-full bg-emerald-400/40 animate-ping"></span>`
      : `<span class="absolute -inset-1.5 rounded-full bg-blue-400/30 animate-pulse"></span>`;

    const iconHtml = `
      <div class="relative flex items-center justify-center cursor-pointer select-none">
        ${pulseRing}
        <div class="relative w-11 h-11 rounded-2xl bg-gradient-to-tr ${bgGradient} text-white shadow-xl border-2 flex flex-col items-center justify-center">
          ${
            isPhone
              ? `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" stroke-width="2"></rect><path d="M12 18h.01" stroke-width="2" stroke-linecap="round"></path></svg>`
              : `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="18" height="12" x="3" y="4" rx="2" stroke-width="2"></rect><line x1="2" x2="22" y1="20" y2="20" stroke-width="2"></line></svg>`
          }
          <span class="text-[9px] font-bold font-mono leading-none mt-0.5">${device.battery}%</span>
        </div>
        <div class="absolute -bottom-6 bg-black/80 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md border border-white/20">
          ${device.name || (isPhone ? 'Oppo Phone' : 'pearOS Laptop')}
        </div>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-fleet-pin',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -24]
    });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default Dahegam coordinates
    const defaultLat = 23.168191;
    const defaultLng = 72.822328;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // Add zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer (Google Maps Hybrid)
    const initialLayer = L.tileLayer(GOOGLE_TILE_LAYERS[activeLayer].url, {
      maxZoom: GOOGLE_TILE_LAYERS[activeLayer].maxZoom,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    tileLayerRef.current = initialLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when layer switch changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const newLayer = L.tileLayer(GOOGLE_TILE_LAYERS[activeLayer].url, {
      maxZoom: GOOGLE_TILE_LAYERS[activeLayer].maxZoom,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [activeLayer]);

  // Fetch Fleet Telemetry Function
  const fetchFleetData = async () => {
    try {
      setIsRefreshing(true);
      const res = await api.getFleetTelemetry();
      if (res && res.devices && res.devices.length > 0) {
        setDevices(res.devices);
        setLastUpdated(new Date().toLocaleTimeString());

        const oppo = res.devices.find((d: any) => d.id === 'oppo' || d.role === 'mobile');
        const laptop = res.devices.find((d: any) => d.id === 'laptop-host' || d.role === 'laptop');

        if (oppo) {
          setSirenActive(Boolean(oppo.siren_active));
          setStrobeActive(Boolean(oppo.strobe_active));
        }

        // Distance Calculation
        if (oppo && laptop && oppo.lat && oppo.lng && laptop.lat && laptop.lng) {
          const dist = calculateDistance(oppo.lat, oppo.lng, laptop.lat, laptop.lng);
          setDistanceMeters(dist);
        }

        // Update Markers on Leaflet Map
        const map = mapInstanceRef.current;
        if (map) {
          const latLngs: L.LatLngExpression[] = [];

          res.devices.forEach((dev: FleetDevice) => {
            if (!dev.lat || !dev.lng) return;
            latLngs.push([dev.lat, dev.lng]);

            // Marker
            if (markersRef.current[dev.id]) {
              markersRef.current[dev.id].setLatLng([dev.lat, dev.lng]);
              markersRef.current[dev.id].setIcon(createDeviceIcon(dev));
            } else {
              const marker = L.marker([dev.lat, dev.lng], {
                icon: createDeviceIcon(dev)
              }).addTo(map);

              marker.on('click', () => {
                setSelectedDevice(dev);
                triggerHaptic(40);
              });

              markersRef.current[dev.id] = marker;
            }

            // Accuracy Circle
            const circleColor = dev.role === 'mobile' ? '#10b981' : '#3b82f6';
            if (circlesRef.current[dev.id]) {
              circlesRef.current[dev.id].setLatLng([dev.lat, dev.lng]);
              circlesRef.current[dev.id].setRadius(dev.accuracy || 15);
            } else {
              const circle = L.circle([dev.lat, dev.lng], {
                radius: dev.accuracy || 15,
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.12,
                weight: 1
              }).addTo(map);
              circlesRef.current[dev.id] = circle;
            }
          });

          // Polyline between phone and laptop
          if (oppo && laptop && oppo.lat && oppo.lng && laptop.lat && laptop.lng) {
            const path: [number, number][] = [
              [laptop.lat, laptop.lng],
              [oppo.lat, oppo.lng]
            ];
            if (polylineRef.current) {
              polylineRef.current.setLatLngs(path);
            } else {
              polylineRef.current = L.polyline(path, {
                color: '#007AFF',
                weight: 3,
                dashArray: '8, 8',
                opacity: 0.8
              }).addTo(map);
            }
          }

          // Virtual Leash Perimeter Circle around Laptop
          if (laptop && laptop.lat && laptop.lng) {
            if (leashActive) {
              if (leashCircleRef.current) {
                leashCircleRef.current.setLatLng([laptop.lat, laptop.lng]);
                leashCircleRef.current.setRadius(leashRadius);
              } else {
                leashCircleRef.current = L.circle([laptop.lat, laptop.lng], {
                  radius: leashRadius,
                  color: '#FF3B30',
                  weight: 2,
                  dashArray: '6, 6',
                  fillColor: '#FF3B30',
                  fillOpacity: 0.08
                }).addTo(map);
              }
            } else if (leashCircleRef.current) {
              map.removeLayer(leashCircleRef.current);
              leashCircleRef.current = null;
            }
          }
        }
      }
    } catch (err) {
      console.error('Fleet telemetry fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Polling Interval
  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Quick Map Navigation Helpers
  const handleCenterOn = (targetId: string) => {
    triggerHaptic(40);
    const dev = devices.find((d) => d.id === targetId);
    if (dev && dev.lat && dev.lng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([dev.lat, dev.lng], 18, { duration: 1.2 });
      setSelectedDevice(dev);
    }
  };

  const handleFitBounds = () => {
    triggerHaptic(40);
    if (!mapInstanceRef.current || devices.length === 0) return;
    const group = L.featureGroup(Object.values(markersRef.current));
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
  };

  // Toggle 110dB Emergency Siren on Phone
  const handleToggleSiren = async () => {
    triggerHaptic(100);
    const next = !sirenActive;
    setSirenActive(next);
    try {
      await api.executeDeviceAction('oppo', 'siren', next);
      addNotification(
        next ? '🚨 110dB Siren Activated' : 'Siren Silenced',
        next ? 'High-decibel emergency siren sounding on Oppo phone' : 'Oppo phone siren turned off',
        next ? 'error' : 'info'
      );
    } catch {
      setSirenActive(!next);
    }
  };

  // Toggle Strobe Flashlight on Phone
  const handleToggleStrobe = async () => {
    triggerHaptic(50);
    const next = !strobeActive;
    setStrobeActive(next);
    try {
      await api.executeDeviceAction('oppo', 'strobe', next);
      addNotification('Flashlight', next ? 'Oppo Strobe Turned ON' : 'Oppo Flashlight OFF', 'info');
    } catch {
      setStrobeActive(!next);
    }
  };

  // Toggle Virtual Leash
  const handleToggleLeash = async () => {
    const next = !leashActive;
    setLeashActive(next);
    triggerHaptic(30);
    try {
      await api.setLeashConfig(next, leashRadius);
      addNotification('Virtual Leash', next ? `Leash Armed (${leashRadius}m)` : 'Leash Disarmed', 'info');
    } catch {}
  };

  const handleUpdateLeashRadius = async (r: number) => {
    setLeashRadius(r);
    triggerHaptic(20);
    if (leashCircleRef.current) leashCircleRef.current.setRadius(r);
    try {
      await api.setLeashConfig(leashActive, r);
    } catch {}
  };

  // Open Direct in Google Maps App
  const handleOpenGoogleMaps = (dev?: FleetDevice) => {
    const target = dev || devices.find((d) => d.role === 'mobile') || devices[0];
    if (target && target.lat && target.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
      window.open(url, '_blank');
    }
  };

  const oppoDevice = devices.find((d) => d.id === 'oppo' || d.role === 'mobile');
  const laptopDevice = devices.find((d) => d.id === 'laptop-host' || d.role === 'laptop');
  const isLeashBreached = Boolean(leashActive && distanceMeters !== null && distanceMeters > leashRadius);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#F2F2F7]">
      {/* Top Floating Glass Bar */}
      <div className="absolute top-3 inset-x-3 z-[1000] flex items-center justify-between pointer-events-none">
        {/* Title & Live Status */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-black/5 shadow-md px-3.5 py-2 rounded-2xl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-slate-900 tracking-tight">Google Maps Fleet</span>
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                LIVE GPS
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2">
              <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Connecting GPS...'}</span>
              {distanceMeters !== null && (
                <span className="font-semibold text-blue-600">
                  • {distanceMeters > 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters} m`} apart
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Map Layer Switcher & Refresh */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/90 backdrop-blur-xl border border-black/5 shadow-md p-1 rounded-2xl">
          {(['hybrid', 'satellite', 'roadmap', 'terrain'] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => {
                triggerHaptic(30);
                setActiveLayer(layer);
              }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-xl capitalize transition-all ${
                activeLayer === layer
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {layer}
            </button>
          ))}
          <button
            onClick={() => {
              triggerHaptic(40);
              fetchFleetData();
            }}
            disabled={isRefreshing}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Virtual Leash Breach Emergency Banner */}
      {isLeashBreached && (
        <div className="absolute top-16 inset-x-3 z-[1100] bg-rose-600/95 backdrop-blur-xl border border-rose-300 shadow-xl rounded-2xl px-4 py-2.5 flex items-center justify-between text-white animate-pulse">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-white" />
            <div>
              <div className="font-bold text-xs tracking-tight">🚨 VIRTUAL LEASH BREACHED!</div>
              <div className="text-[10px] text-rose-100">
                Oppo phone is {distanceMeters}m away from laptop (Safe Tether: {leashRadius}m)
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleSiren}
            className="px-3 py-1 bg-white text-rose-700 font-bold text-xs rounded-xl shadow-sm hover:bg-rose-50 active:scale-95 transition-all"
          >
            {sirenActive ? 'Stop Siren' : 'Sound 110dB Alarm'}
          </button>
        </div>
      )}

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full flex-1 z-0" />

      {/* Right Floating Quick Navigation Controls */}
      <div className="absolute right-3 top-20 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => handleCenterOn('oppo')}
          className="p-2.5 bg-white/90 hover:bg-white backdrop-blur-xl border border-black/5 rounded-2xl shadow-md text-emerald-600 active:scale-95 transition-all flex items-center justify-center"
          title="Center on Oppo Phone"
        >
          <Smartphone className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleCenterOn('laptop-host')}
          className="p-2.5 bg-white/90 hover:bg-white backdrop-blur-xl border border-black/5 rounded-2xl shadow-md text-blue-600 active:scale-95 transition-all flex items-center justify-center"
          title="Center on pearOS Laptop"
        >
          <Laptop className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitBounds}
          className="p-2.5 bg-white/90 hover:bg-white backdrop-blur-xl border border-black/5 rounded-2xl shadow-md text-slate-700 active:scale-95 transition-all flex items-center justify-center"
          title="Fit Both in View"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Telemetry & Emergency Controls Card */}
      <div className="absolute bottom-3 inset-x-3 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-black/5 shadow-xl rounded-3xl p-3.5 transition-all">
          {/* Devices Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2.5">
            {/* Oppo Mobile Card */}
            <div
              onClick={() => handleCenterOn('oppo')}
              className="cursor-pointer flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {oppoDevice?.name || 'Oppo Mobile Phone'}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-medium px-1.5 py-0.2 rounded-full">
                      Mobile
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {oppoDevice?.address || 'Dahegam, Gandhinagar, Gujarat'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">
                  {oppoDevice?.is_charging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>{oppoDevice?.battery ?? 88}%</span>
                </div>
              </div>
            </div>

            {/* pearOS Laptop Card */}
            <div
              onClick={() => handleCenterOn('laptop-host')}
              className="cursor-pointer flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Laptop className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {laptopDevice?.name || 'pearOS Tactical Laptop'}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.2 rounded-full">
                      Host
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {laptopDevice?.address || 'Workstation Host Node'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">
                  <BatteryCharging className="w-3.5 h-3.5 text-blue-600" />
                  <span>{laptopDevice?.battery ?? 95}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Leash Anti-Theft Tether Bar */}
          <div className="flex items-center justify-between bg-slate-50/90 p-2 rounded-2xl border border-slate-200/80 mb-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleLeash}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border transition-all ${
                  leashActive
                    ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {leashActive ? '🛡️ Leash Tether: ON' : 'Leash: OFF'}
              </button>
              <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">Perimeter:</span>
            </div>

            <div className="flex items-center gap-1">
              {[25, 50, 100, 250].map((r) => (
                <button
                  key={r}
                  onClick={() => handleUpdateLeashRadius(r)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-lg transition-all ${
                    leashRadius === r
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
            {/* Siren Trigger */}
            <button
              onClick={handleToggleSiren}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-medium text-xs transition-all active:scale-95 ${
                sirenActive
                  ? 'bg-rose-600 text-white shadow-lg animate-pulse'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              {sirenActive ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{sirenActive ? 'Stop 110dB Siren' : '110dB Phone Siren'}</span>
            </button>

            {/* Flashlight Strobe Trigger */}
            <button
              onClick={handleToggleStrobe}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-medium text-xs transition-all active:scale-95 ${
                strobeActive
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Flashlight className="w-4 h-4" />
              <span>{strobeActive ? 'Strobe ON' : 'Phone Flashlight'}</span>
            </button>

            {/* Google Maps External App Navigation Link */}
            <button
              onClick={() => handleOpenGoogleMaps()}
              className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in</span>
              <span>Google Maps</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
