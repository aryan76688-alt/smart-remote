import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Server,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  LogOut,
  Radio,
  Cpu,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface DeviceSelectPageProps {
  onDeviceSelected: (device: any) => void;
  onLogout: () => void;
}

export const DeviceSelectPage: React.FC<DeviceSelectPageProps> = ({ onDeviceSelected, onLogout }) => {
  const { systemInfo, tailscaleIp, addNotification, triggerHaptic } = useApp();
  const [selectedId, setSelectedId] = useState<string>('pearos-primary');
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
      id: 'pearos-primary',
      name: 'pearOS Tactical Workstation',
      type: 'Primary Host (Live CCTV & Fleet)',
      ip: tailscaleIp || '100.69.194.11',
      hostname: systemInfo?.hostname || 'pearOS-machine',
      os: 'pearOS Workstation 2.0 (macOS Sequoia Engine)',
      cpu: systemInfo?.architecture ? `${systemInfo.architecture} Architecture` : '64-Bit Multi-Core',
      status: pingStatus === 'online' ? 'ONLINE' : pingStatus === 'checking' ? 'CHECKING...' : 'DISCONNECTED',
      badge: 'RECOMMENDED'
    },
    {
      id: 'local-loopback',
      name: 'Local Loopback Host',
      type: 'Local Controller',
      ip: '127.0.0.1:7070',
      hostname: 'localhost',
      os: 'pearOS Localhost',
      cpu: '64-Bit Fast IPC',
      status: 'ONLINE',
      badge: 'LOCAL'
    }
  ];

  const handleConnect = () => {
    triggerHaptic(40);
    const chosenDevice = devices.find((d) => d.id === selectedId) || devices[0];
    addNotification('Connected', `Connected to ${chosenDevice.name}`, 'success');
    onDeviceSelected(chosenDevice);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-center items-center p-4 bg-[#F2F2F7] overflow-y-auto select-none font-sans">
      <div className="w-full max-w-lg bg-white/85 backdrop-blur-3xl border border-black/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md text-xl font-bold">
              
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Select pearOS Node</h1>
              <p className="text-xs text-slate-500">Choose host target for remote control &amp; fleet</p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic(30);
              onLogout();
            }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Device Selection List */}
        <div className="space-y-3">
          {devices.map((dev) => {
            const isSelected = selectedId === dev.id;

            return (
              <div
                key={dev.id}
                onClick={() => {
                  triggerHaptic(30);
                  setSelectedId(dev.id);
                }}
                className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'bg-white/80 hover:bg-white border-black/5 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{dev.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {dev.badge}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">{dev.ip}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        dev.status === 'ONLINE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {dev.status}
                    </span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{dev.os}</span>
                  <span>{dev.cpu}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connect Action Button */}
        <button
          onClick={handleConnect}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span>Connect to Workstation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
