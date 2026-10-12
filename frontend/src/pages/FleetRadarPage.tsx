import React, { useState, useEffect, useRef } from 'react';
import {
  Compass, Volume2, Flashlight, Eye, ShieldCheck, ShieldAlert,
  Battery, BatteryCharging, Wifi, Navigation, RefreshCw, AlertTriangle,
  Radio, Laptop, Smartphone, ExternalLink, X, MapPin, Locate, Crosshair
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface DeviceItem {
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
  siren_active: boolean;
  strobe_active: boolean;
  leash_active: boolean;
  leash_radius: number;
  address?: string;
}

export const FleetRadarPage: React.FC = () => {
  const { triggerHaptic, isApk } = useApp();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [proximityList, setProximityList] = useState<any[]>([]);
  const [brokenLeashes, setBrokenLeashes] = useState<any[]>([]);
  const [radarSweepAngle, setRadarSweepAngle] = useState<number>(0);
  const [streetViewOpen, setStreetViewOpen] = useState<boolean>(false);
  const [streetViewCoords, setStreetViewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nightVision, setNightVision] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Poll fleet telemetry every 4 seconds
  const fetchFleet = async () => {
    try {
      const [fleetRes, proxRes] = await Promise.all([
        api.getFleetTelemetry(),
        api.getProximityMatrix()
      ]);

      if (fleetRes && fleetRes.devices) {
        setDevices(fleetRes.devices);
        if (!selectedDevice && fleetRes.devices.length > 0) {
          // Default selection to first mobile device or laptop
          const firstMobile = fleetRes.devices.find(d => d.role === 'mobile') || fleetRes.devices[0];
          setSelectedDevice(firstMobile);
        } else if (selectedDevice) {
          const updated = fleetRes.devices.find(d => d.id === selectedDevice.id);
          if (updated) setSelectedDevice(updated);
        }
      }

      if (proxRes && proxRes.matrix) {
        setProximityList(proxRes.matrix);
        setBrokenLeashes(proxRes.broken_leashes || []);
      }
    } catch (err) {
      console.error('Failed to fetch fleet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animate radar sweep needle
  useEffect(() => {
    const sweepInterval = setInterval(() => {
      setRadarSweepAngle(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(sweepInterval);
  }, []);

  // Handle native Android siren / strobe / actions
  const handleDeviceAction = async (action: 'siren' | 'strobe' | 'leash' | 'lock') => {
    if (!selectedDevice) return;
    triggerHaptic(50);
    setActionInProgress(action);

    try {
      const res = await api.executeDeviceAction(selectedDevice.id, action);
      if (res && res.success) {
        // If native APK on Android, call native bridge for siren/strobe
        if (isApk && (window as any).AndroidApp) {
          if (action === 'siren') {
            try {
              (window as any).AndroidApp.triggerSirenAlarm(res.active);
            } catch (e) {
              console.warn('Native siren trigger error:', e);
            }
          } else if (action === 'strobe') {
            try {
              (window as any).AndroidApp.setFlashlightStrobe(res.active);
            } catch (e) {
              console.warn('Native strobe error:', e);
            }
          }
        }
        await fetchFleet();
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message || err}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenStreetView = (lat: number, lng: number) => {
    triggerHaptic(30);
    setStreetViewCoords({ lat, lng });
    setStreetViewOpen(true);
  };

  const laptopHost = devices.find(d => d.role === 'laptop') || devices[0];

  return (
    <div className={`relative min-h-screen pb-24 text-slate-100 select-none overflow-hidden ${
      nightVision ? 'bg-[#001408] text-emerald-400 font-mono' : 'bg-[#030712] font-sans'
    }`}>

      {/* Top Cyber Telemetry & Status Strip */}
      <div className={`px-4 pt-3 pb-2 border-b flex items-center justify-between backdrop-blur-md ${
        nightVision ? 'border-emerald-900/60 bg-[#001a0b]/80' : 'border-cyan-500/20 bg-[#090d16]/80'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>FLEET RADAR</span>
              <span className="text-[10px] bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30">
                {devices.filter(d => d.status === 'online').length} ONLINE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {laptopHost ? `${laptopHost.lat.toFixed(4)}°N, ${laptopHost.lng.toFixed(4)}°E` : 'GPS LOCK SEARCHING...'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNightVision(!nightVision)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded border flex items-center space-x-1 transition-all ${
              nightVision
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-500/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>NV-HUD</span>
          </button>
          <button
            onClick={fetchFleet}
            className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-cyan-400 active:rotate-180 transition-all"
            title="Refresh Radar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leash Alarm Banner if Broken */}
      {brokenLeashes.length > 0 && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2 text-rose-300 text-xs font-mono font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>LEASH BREACH: {brokenLeashes[0].device_name} is {Math.round(brokenLeashes[0].distance)}m away!</span>
          </div>
          <button
            onClick={() => handleDeviceAction('siren')}
            className="px-2 py-0.5 text-[10px] font-mono bg-rose-600 hover:bg-rose-500 text-white rounded font-bold"
          >
            RING SIREN
          </button>
        </div>
      )}

      {/* Main Interactive Tactical Map Viewport */}
      <div className="relative w-full h-[52vh] bg-[#020610] overflow-hidden border-b border-cyan-500/20">

        {/* Tactical Coordinate Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:24px_24px]"></div>

        {/* Concentric Radar Range Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85vw] h-[85vw] max-w-[420px] max-h-[420px] rounded-full border border-cyan-500/15 relative flex items-center justify-center">
            <div className="w-[60%] h-[60%] rounded-full border border-cyan-500/20 flex items-center justify-center">
              <div className="w-[40%] h-[40%] rounded-full border border-cyan-500/25"></div>
            </div>
            {/* Range markers */}
            <span className="absolute top-1 text-[9px] font-mono text-cyan-500/50">500m</span>
            <span className="absolute bottom-1 text-[9px] font-mono text-cyan-500/50">100m</span>
            <span className="absolute left-1 text-[9px] font-mono text-cyan-500/50">250m</span>
            <span className="absolute right-1 text-[9px] font-mono text-cyan-500/50">250m</span>
          </div>
        </div>

        {/* Rotating Radar Sweep Line */}
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ transform: `rotate(${radarSweepAngle}deg)` }}
        >
          <div className="w-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-cyan-200 origin-left shadow-[0_0_8px_#00f0ff]"></div>
        </div>

        {/* Tactical Crosshair Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border border-cyan-500/30 rounded-full flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-cyan-400/40" />
          </div>
        </div>

        {/* Compass Dial Indicator (Top Right) */}
        <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-800 text-[10px] font-mono flex items-center space-x-1.5 text-cyan-400">
          <Compass className="w-4 h-4 animate-spin text-cyan-400" style={{ animationDuration: '20s' }} />
          <span>N 042° // HUD</span>
        </div>

        {/* Live Device Markers on Tactical Map */}
        <div className="absolute inset-0">
          {devices.map((device, idx) => {
            const isSelected = selectedDevice?.id === device.id;
            const isLaptop = device.role === 'laptop';

            // Layout device markers in dynamic radial offsets from center based on index
            const angle = (idx * (360 / Math.max(devices.length, 1)) + 45) * (Math.PI / 180);
            const radius = isLaptop ? 0 : 70 + (idx * 35);
            const leftPercent = 50 + (radius * Math.cos(angle)) / 4.2;
            const topPercent = 50 + (radius * Math.sin(angle)) / 4.2;

            return (
              <div
                key={device.id}
                onClick={() => {
                  triggerHaptic(20);
                  setSelectedDevice(device);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500"
                style={{
                  left: `${Math.max(12, Math.min(88, leftPercent))}%`,
                  top: `${Math.max(12, Math.min(88, topPercent))}%`
                }}
              >
                {/* Accuracy ring */}
                <div className={`absolute -inset-4 rounded-full border border-dashed transition-all ${
                  isSelected ? 'border-cyan-400/60 animate-ping' : 'border-slate-600/30'
                }`}></div>

                {/* Device Icon Pin */}
                <div className={`relative px-2 py-1 rounded-md border flex items-center space-x-1.5 shadow-lg backdrop-blur-md transition-all ${
                  isLaptop
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-cyan-500/20'
                    : isSelected
                    ? 'bg-slate-900/95 border-cyan-400 text-cyan-400 ring-2 ring-cyan-500/50 scale-110'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/40'
                }`}>
                  {isLaptop ? <Laptop className="w-3.5 h-3.5 text-cyan-400" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
                  <span className="text-[11px] font-mono font-bold whitespace-nowrap">
                    {device.name.replace(/ \(Primary\)| Tactical/g, '')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${
                    device.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-slate-500'
                  }`}></span>
                </div>

                {/* Battery & Distance Pill below marker */}
                <div className="mt-1 flex items-center justify-center space-x-1">
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/70 border border-slate-800 text-slate-300">
                    {device.battery}%
                  </span>
                  {!isLaptop && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300">
                      {proximityList.find(p => p.target_id === device.id)?.distance_meters
                        ? `${Math.round(proximityList.find(p => p.target_id === device.id).distance_meters)}m`
                        : '±8m'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* External Google Maps Button */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
          {selectedDevice && (
            <button
              onClick={() => handleOpenStreetView(selectedDevice.lat, selectedDevice.lng)}
              className="px-2.5 py-1 text-[11px] font-mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded border border-cyan-500/40 flex items-center space-x-1 backdrop-blur-md shadow-md"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>STREET VIEW</span>
            </button>
          )}
          <a
            href={selectedDevice ? `https://www.google.com/maps?q=${selectedDevice.lat},${selectedDevice.lng}` : '#'}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 bg-slate-900/90 text-slate-300 hover:text-cyan-400 rounded border border-slate-700 backdrop-blur-md shadow-md"
            title="Open in Google Maps"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Device Selector Horizontal Carousel / Chips */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#090d16]/90 flex items-center space-x-2 overflow-x-auto no-scrollbar">
        {devices.map(dev => {
          const isSelected = selectedDevice?.id === dev.id;
          return (
            <button
              key={dev.id}
              onClick={() => {
                triggerHaptic(15);
                setSelectedDevice(dev);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex items-center space-x-1.5 border transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {dev.role === 'laptop' ? <Laptop className="w-3.5 h-3.5 text-cyan-400" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{dev.name}</span>
              <span className={`text-[10px] font-bold ${dev.battery < 20 ? 'text-rose-400' : 'text-slate-400'}`}>
                {dev.battery}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Device Tactical Control Drawer */}
      {selectedDevice && (
        <div className="p-4 space-y-4">
          <div className="bg-[#090d16] border border-cyan-500/20 rounded-xl p-3.5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header info */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-mono font-bold tracking-wide text-white">
                    {selectedDevice.name}
                  </h2>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    selectedDevice.status === 'online'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {selectedDevice.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedDevice.model}
                </p>
              </div>

              {/* Battery pill */}
              <div className="flex items-center space-x-1 text-xs font-mono bg-black/40 px-2 py-1 rounded border border-slate-800">
                {selectedDevice.is_charging ? (
                  <BatteryCharging className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Battery className={`w-4 h-4 ${selectedDevice.battery < 20 ? 'text-rose-400' : 'text-cyan-400'}`} />
                )}
                <span className={selectedDevice.battery < 20 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                  {selectedDevice.battery}%
                </span>
              </div>
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">ACCURACY</span>
                <span className="text-cyan-300 font-bold">±{selectedDevice.accuracy}m</span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">DISTANCE</span>
                <span className="text-emerald-300 font-bold">
                  {selectedDevice.role === 'laptop'
                    ? 'HOST ROOT'
                    : proximityList.find(p => p.target_id === selectedDevice.id)?.distance_meters
                    ? `${Math.round(proximityList.find(p => p.target_id === selectedDevice.id).distance_meters)} m`
                    : '±12 m'}
                </span>
              </div>
              <div className="bg-black/30 p-2 rounded border border-slate-800/50">
                <span className="text-slate-500 block text-[9px]">SPEED</span>
                <span className="text-amber-300 font-bold">{selectedDevice.speed || 0} km/h</span>
              </div>
            </div>

            {selectedDevice.address && (
              <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{selectedDevice.address}</span>
              </div>
            )}

            {/* 4 High-Impact Tactical 1-Tap Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2">
              <button
                onClick={() => handleDeviceAction('siren')}
                disabled={actionInProgress === 'siren'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.siren_active
                    ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/60'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{selectedDevice.siren_active ? 'STOP SIREN' : 'SIREN PING'}</span>
              </button>

              <button
                onClick={() => handleDeviceAction('strobe')}
                disabled={actionInProgress === 'strobe'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.strobe_active
                    ? 'bg-amber-500 border-amber-300 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse'
                    : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/60'
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span>{selectedDevice.strobe_active ? 'STROBE ON' : 'STROBE LIGHT'}</span>
              </button>

              <button
                onClick={() => handleOpenStreetView(selectedDevice.lat, selectedDevice.lng)}
                className="py-2 px-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>STREET VIEW</span>
              </button>

              <button
                onClick={() => handleDeviceAction('leash')}
                disabled={actionInProgress === 'leash'}
                className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                  selectedDevice.leash_active
                    ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{selectedDevice.leash_active ? 'LEASH ARMED' : 'ARM LEASH'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Street View Optical Vantage Modal */}
      {streetViewOpen && streetViewCoords && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-xl bg-[#090d16] border border-cyan-500/40 rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-sm font-bold text-white">GOOGLE STREET VIEW VANTAGE</span>
              </div>
              <button
                onClick={() => setStreetViewOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full h-80 bg-black">
              <iframe
                title="Google Street View"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${streetViewCoords.lat},${streetViewCoords.lng}&layer=c&cbll=${streetViewCoords.lat},${streetViewCoords.lng}&cbp=11,0,0,0,0&output=svembed`}
              ></iframe>
            </div>

            <div className="p-3 bg-black/50 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>COORDS: {streetViewCoords.lat.toFixed(5)}°, {streetViewCoords.lng.toFixed(5)}°</span>
              <a
                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewCoords.lat},${streetViewCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center space-x-1"
              >
                <span>Full Screen Panorama</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
