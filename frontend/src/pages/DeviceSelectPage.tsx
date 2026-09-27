import React, { useState, useEffect } from 'react';
import {
  Server, Smartphone, Laptop, Wifi, ShieldCheck, CheckCircle2,
  RefreshCw, ArrowRight, LogOut, Radio, Cpu, HardDrive, Zap,
  Sliders, Plus, Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface DeviceSelectPageProps {
  onDeviceSelected: (device: any) => void;
  onLogout: () => void;
}

export const DeviceSelectPage: React.FC<DeviceSelectPageProps> = ({ onDeviceSelected, onLogout }) => {
  const { systemInfo, tailscaleIp, addNotification, setDeviceMode, isApk } = useApp();
  const [selectedId, setSelectedId] = useState<string>('kali-primary');
  const [mobileProfile, setMobileProfile] = useState<boolean>(true);
  const [customIp, setCustomIp] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [pingStatus, setPingStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const checkConnectivity = async () => {
    setPingStatus('checking');
    try {
      const res = await api.getSystemInfo();
      if (res && res.hostname) {
        setPingStatus('online');
      } else {
        setPingStatus('offline');
      }
    } catch {
      setPingStatus('offline');
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  const devices = [
    {
      id: 'kali-primary',
      name: 'Kali Linux Workstation',
      type: 'Primary Workstation',
      ip: tailscaleIp || '100.69.194.11',
      hostname: systemInfo?.hostname || 'kali',
      os: systemInfo?.os_name || 'Kali GNU/Linux Rolling',
      cpu: systemInfo?.architecture ? `${systemInfo.architecture} Architecture` : '64-Bit Multi-Core',
      status: pingStatus === 'online' ? 'ONLINE' : (pingStatus === 'checking' ? 'CHECKING...' : 'DISCONNECTED'),
      isTailscale: true,
      badge: 'RECOMMENDED'
    },
    {
      id: 'local-host',
      name: 'Local Host Controller',
      type: 'Direct Loopback',
      ip: '127.0.0.1:7070',
      hostname: 'localhost',
      os: systemInfo?.os_name || 'Linux Workstation',
      cpu: systemInfo?.architecture ? `${systemInfo.architecture} Architecture` : '64-Bit Multi-Core',
      status: 'ONLINE',
      isTailscale: false,
      badge: 'LOCAL'
    }
  ];

  const handleConnect = () => {
    let chosenDevice;
    if (selectedId === 'custom' && customIp.trim()) {
      chosenDevice = {
        id: 'custom',
        name: `Remote (${customIp.trim()})`,
        ip: customIp.trim(),
        hostname: 'remote-host'
      };
    } else {
      chosenDevice = devices.find(d => d.id === selectedId) || devices[0];
    }

    if (mobileProfile) {
      setDeviceMode('mobile');
      localStorage.setItem('smart_remote_device_mode', 'mobile');
    }

    addNotification('Device Connected', `Active link established to ${chosenDevice.name} (${chosenDevice.ip})`, 'success');
    onDeviceSelected(chosenDevice);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-start sm:justify-center items-center p-3 sm:p-6 pt-10 sm:pt-6 pb-10 bg-cyber-bg overflow-y-auto select-none font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-cyber-surface border border-cyber-border rounded-3xl p-4 sm:p-8 shadow-2xl space-y-5 relative z-10 backdrop-blur-xl animate-in fade-in my-auto sm:my-0">
        {/* Header with Logout & Step Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-mono text-cyan-400 font-semibold tracking-wider uppercase">
                Step 2 of 3 &bull; Target Selection
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-100">
                Select Remote Linux Machine
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={checkConnectivity}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
              title="Refresh Devices"
            >
              <RefreshCw className={`w-4 h-4 ${pingStatus === 'checking' ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Android Native App (.apk) Download Banner - Web users only */}
        {!isApk && (
          <div className="p-3.5 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/40 border border-cyan-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>Android Native App (.apk)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                    RECOMMENDED
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Install native APK for full phone mic intercom &amp; fast 60FPS stream</div>
              </div>
            </div>
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-1.5 active:scale-95 shrink-0"
            >
              <Smartphone className="w-4 h-4" />
              <span>DOWNLOAD .APK</span>
            </a>
          </div>
        )}

        {/* Device Cards */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Available Controllers ({devices.length})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {devices.map((dev) => {
              const isSelected = selectedId === dev.id;
              return (
                <div
                  key={dev.id}
                  onClick={() => {
                    setSelectedId(dev.id);
                    setShowCustomInput(false);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
                    isSelected
                      ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900/90 border-cyan-500 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Selected check circle */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}>
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                          {dev.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {dev.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {dev.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          {dev.badge}
                        </span>
                      )}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        dev.status === 'ONLINE'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
                          : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      }`}>
                        {dev.status}
                      </span>
                    </div>
                  </div>

                  {/* Machine Specifications */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>IP Address:</span>
                      <strong className="text-slate-200">{dev.ip}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Hostname:</span>
                      <span className="text-slate-200">{dev.hostname}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>System:</span>
                      <span className="text-slate-300 truncate max-w-[140px]">{dev.os}</span>
                    </div>
                  </div>

                  {/* Selection Indicator Pill */}
                  <div className="mt-3.5 pt-2 flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {dev.isTailscale ? 'Tailscale Encrypted' : 'Direct Loopback'}
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom IP Option Toggle */}
          <div className="pt-1">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedId('custom');
                  setShowCustomInput(true);
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors font-mono"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect to Custom Tailscale IP or Local Node
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                <label className="text-xs text-slate-300 font-semibold block">
                  Custom IP or Domain
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customIp}
                    onChange={(e) => setCustomIp(e.target.value)}
                    placeholder="100.x.y.z:7070 or 192.168.1.50"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedId('custom')}
                    className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold rounded-lg"
                  >
                    Select
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Samsung Galaxy A36 Optimization Banner */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                Samsung Galaxy A36 Profile
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                100dvh safe-area padding, right-hand thumb mic, and 60 FPS touchpad acceleration.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileProfile(!mobileProfile)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              mobileProfile ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              mobileProfile ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Action Button: Connect & Enter Remote */}
        <div className="pt-2">
          <button
            onClick={handleConnect}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-black text-sm tracking-wider uppercase transition-all shadow-xl shadow-cyan-500/25 flex items-center justify-center space-x-2.5 active:scale-98"
          >
            <span>Launch Remote Controller</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default DeviceSelectPage;
