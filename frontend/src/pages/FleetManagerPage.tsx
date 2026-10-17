import React, { useState, useEffect, useRef } from 'react';
import {
  Laptop, Smartphone, Battery, BatteryCharging, Radio,
  ShieldCheck, ShieldAlert, Volume2, Flashlight, Eye,
  RefreshCw, Plus, QrCode, Download, ExternalLink, CheckCircle,
  MapPin, Clock, AlertTriangle, Lock,
  Camera, Mic, VolumeX, X
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { CameraViewerModal } from '../components/camera/CameraViewerModal';
import { MicMonitorHud } from '../components/camera/MicMonitorHud';

export const FleetManagerPage: React.FC = () => {
  const { triggerHaptic, isApk } = useApp();
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [cameraModalDevice, setCameraModalDevice] = useState<any | null>(null);
  const [micAudioDevice, setMicAudioDevice] = useState<any | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchFleet = async () => {
    try {
      const res = await api.getFleetTelemetry();
      if (res && res.devices) {
        // Exclusively show Kali Tactical Laptop and Oppo Mobile Phone
        const filtered = res.devices.filter((d: any) => d.id === 'laptop-host' || d.id === 'oppo' || d.role === 'laptop' || d.role === 'mobile');
        setFleet(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (deviceId: string, action: string) => {
    triggerHaptic(40);
    setActionId(`${deviceId}-${action}`);
    try {
      await api.executeDeviceAction(deviceId, action);
      await fetchFleet();
    } catch (err: any) {
      alert(`Action failed: ${err.message || err}`);
    } finally {
      setActionId(null);
    }
  };

  const toggleMicAudio = (dev: any) => {
    triggerHaptic(30);
    if (micAudioDevice && micAudioDevice.id === dev.id) {
      setMicAudioDevice(null);
    } else {
      setMicAudioDevice(dev);
    }
  };

  const onlineCount = fleet.filter(d => d.status === 'online').length;
  const avgBattery = fleet.length ? Math.round(fleet.reduce((acc, d) => acc + (d.battery || 0), 0) / fleet.length) : 0;
  const lowBatteryCount = fleet.filter(d => (d.battery || 0) < 20).length;

  return (
    <div className="min-h-screen pb-24 bg-[#030712] text-slate-100 p-4 space-y-4 font-sans select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-mono font-bold tracking-wider text-white">FLEET COMMAND CENTER</h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Synchronized Android Fleet & Kali Master Hub
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setQrModalOpen(true)}
            className="px-2.5 py-1 text-xs font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/40 flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD PHONE</span>
          </button>
          <button
            onClick={fetchFleet}
            className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-400 hover:text-cyan-400"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div className="bg-[#090d16] border border-cyan-500/20 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-500 block">TOTAL NODES</span>
          <span className="text-sm font-bold text-cyan-400">{fleet.length} Active</span>
          <span className="text-[9px] text-emerald-400 block">{onlineCount} Online</span>
        </div>
        <div className="bg-[#090d16] border border-cyan-500/20 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-500 block">AVG BATTERY</span>
          <span className="text-sm font-bold text-white">{avgBattery}%</span>
          <span className="text-[9px] text-slate-400 block">All Devices</span>
        </div>
        <div className="bg-[#090d16] border border-cyan-500/20 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-500 block">POWER ALERTS</span>
          <span className={`text-sm font-bold ${lowBatteryCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {lowBatteryCount} Critical
          </span>
          <span className="text-[9px] text-slate-400 block">&lt; 20% Charge</span>
        </div>
      </div>

      {/* Device List */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono tracking-wider text-slate-400 flex items-center justify-between">
          <span>ACTIVE FLEET NODES ({fleet.length})</span>
          <span className="text-[10px] text-cyan-400">P2P MESH VERIFIED</span>
        </h2>

        {fleet.map(dev => {
          const isLaptop = dev.role === 'laptop';
          return (
            <div
              key={dev.id}
              className={`p-3.5 rounded-xl border bg-[#090d16] transition-all relative overflow-hidden ${
                isLaptop ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2.5">
                  <div className={`p-2 rounded-lg border mt-0.5 ${
                    isLaptop
                      ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-400'
                      : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                  }`}>
                    {isLaptop ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-sm text-white">{dev.name}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                        dev.status === 'online'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {dev.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{dev.model}</p>
                    {dev.address && (
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono mt-1">
                        <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{dev.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Battery Meter */}
                <div className="text-right">
                  <div className="flex items-center justify-end space-x-1 text-xs font-mono">
                    {dev.is_charging ? (
                      <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Battery className={`w-4 h-4 ${dev.battery < 20 ? 'text-rose-400' : 'text-cyan-400'}`} />
                    )}
                    <span className={`font-bold ${dev.battery < 20 ? 'text-rose-400' : 'text-white'}`}>
                      {dev.battery}%
                    </span>
                  </div>
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dev.battery < 20 ? 'bg-rose-500' : dev.is_charging ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, dev.battery))}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
                <button
                  onClick={() => handleAction(dev.id, 'siren')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                    dev.siren_active
                      ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                      : 'bg-rose-950/30 border-rose-500/20 text-rose-300 hover:bg-rose-900/50'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{dev.siren_active ? 'STOP' : 'SIREN'}</span>
                </button>

                <button
                  onClick={() => setCameraModalDevice(dev)}
                  className="py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 border border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-900/50 transition-all"
                >
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  <span>CAMERA</span>
                </button>

                <button
                  onClick={() => toggleMicAudio(dev)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                    micAudioDevice?.id === dev.id
                      ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse'
                      : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300 hover:bg-emerald-900/50'
                  }`}
                >
                  {micAudioDevice?.id === dev.id ? <VolumeX className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{micAudioDevice?.id === dev.id ? 'STOP MIC' : 'MIC'}</span>
                </button>

                <button
                  onClick={() => handleAction(dev.id, 'strobe')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                    dev.strobe_active
                      ? 'bg-amber-500 border-amber-300 text-black animate-pulse'
                      : 'bg-amber-950/30 border-amber-500/20 text-amber-300 hover:bg-amber-900/50'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{dev.strobe_active ? 'STROBE' : 'STROBE'}</span>
                </button>

                <button
                  onClick={() => handleAction(dev.id, 'leash')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-1.5 border transition-all ${
                    dev.leash_active
                      ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{dev.leash_active ? 'LEASH ON' : 'LEASH'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Phone Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-sm bg-[#090d16] border border-cyan-500/40 rounded-xl p-5 shadow-2xl relative text-center">
            <h3 className="font-mono text-sm font-bold text-white tracking-wide">
              ADD ANOTHER PHONE TO FLEET
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Install the Smart Remote APK on any other Android device to link it to this command radar.
            </p>

            <div className="my-4 p-4 bg-white rounded-xl inline-block shadow-inner">
              <QrCode className="w-40 h-40 text-black mx-auto" />
            </div>

            <div className="space-y-2 text-left bg-black/40 p-3 rounded-lg border border-slate-800 text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>1. Download SmartRemote.apk on target phone</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>2. Open app — it auto-detects Tailscale IP</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>3. Live GPS & battery appear on Radar immediately</span>
              </div>
            </div>

            <div className="mt-4 flex items-center space-x-2">
              <a
                href="/SmartRemote.apk"
                download="SmartRemote.apk"
                className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-500/20"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD APK</span>
              </a>
              <button
                onClick={() => setQrModalOpen(false)}
                className="py-2 px-4 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs hover:bg-slate-700"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera View Modal */}
      {cameraModalDevice && (
        <CameraViewerModal
          device={cameraModalDevice}
          onClose={() => setCameraModalDevice(null)}
        />
      )}

      {/* Live Microphone Monitor HUD */}
      {micAudioDevice && (
        <MicMonitorHud
          device={micAudioDevice}
          onClose={() => setMicAudioDevice(null)}
        />
      )}

    </div>
  );
};
