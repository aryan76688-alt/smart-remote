import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  ShieldAlert,
  Server,
  Smartphone,
  Globe,
  Download,
  Copy,
  Check,
  Power,
  RefreshCw,
  Cpu,
  Lock,
  Moon,
  LogOut,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export const SettingsView: React.FC = () => {
  const { triggerHaptic, addNotification, systemInfo, tailscaleIp } = useApp();

  const [serviceStatus, setServiceStatus] = useState<string>('active (running)');
  const [copiedTunnel, setCopiedTunnel] = useState<boolean>(false);
  const [tamperStatus, setTamperStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const tunnelUrl = 'https://smart-remote.aryan76688.workers.dev';

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getTamperStatus();
      if (res) setTamperStatus(res);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyTunnel = () => {
    navigator.clipboard.writeText(tunnelUrl);
    setCopiedTunnel(true);
    triggerHaptic(30);
    setTimeout(() => setCopiedTunnel(false), 2000);
    addNotification('Tunnel Copied', tunnelUrl, 'info');
  };

  const handleEmergencyPanic = async () => {
    if (confirm('TRIGGER EMERGENCY PANIC? This will blank the monitor, mute all audio, and lock the pearOS session.')) {
      triggerHaptic(100);
      try {
        await api.triggerPanic();
        addNotification('EMERGENCY PANIC', 'Workstation display blanked, audio muted, locked', 'error');
      } catch (err: any) {
        addNotification('Panic Error', err.message || 'Trigger failed', 'error');
      }
    }
  };

  const handlePowerAction = async (action: string) => {
    if (!confirm(`Are you sure you want to ${action} pearOS?`)) return;
    triggerHaptic(60);
    try {
      await api.powerAction(action, true);
      addNotification('Power', `Command '${action}' sent to pearOS`, 'info');
    } catch {}
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F2F7] overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-2xl px-4 py-3 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900">System & Daemon Settings</h1>
            <p className="text-[10px] text-slate-500">pearOS Background Services, Android APK & Network Daemons</p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Grid of Daemon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: pearOS Systemd User Service */}
        <div className="bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">smart-remote.service</h3>
                <p className="text-[10px] text-slate-500">Systemd User Manager Daemon</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              ACTIVE (RUNNING)
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span>Lid Switch Inhibitor:</span>
              <span className="font-bold text-emerald-600">systemd-inhibit (Active)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>User Session Linger:</span>
              <span className="font-bold text-emerald-600">Linger=yes (Runs at boot)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Internal Service Port:</span>
              <span className="font-bold text-slate-900">0.0.0.0:7070 (FastAPI)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Android APK Daemon */}
        <div className="bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">SmartRemoteDaemonService</h3>
                <p className="text-[10px] text-slate-500">Android 24/7 Foreground Guard</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              AUTONOMOUS
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Persistent Android service with WakeLock and Foreground Notification. Keeps GPS tracking, 110dB siren, and torch active in the background.
          </p>

          <a
            href="/app-debug.apk"
            download
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download Latest Android APK (5.9 MB)</span>
          </a>
        </div>

        {/* Card 3: Cloudflare Global Tunnel */}
        <div className="bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Cloudflare Tunnel</h3>
                <p className="text-[10px] text-slate-500">Zero-Trust Global Web Access</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              ONLINE
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-mono text-slate-800 truncate pr-2">{tunnelUrl}</span>
            <button
              onClick={handleCopyTunnel}
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-all shrink-0"
              title="Copy URL"
            >
              {copiedTunnel ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Card 4: Anti-Tamper & Security */}
        <div className="bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Anti-Tamper Sensor</h3>
                <p className="text-[10px] text-slate-500">Power, Lid and Battery Security</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
              MONITORED
            </span>
          </div>

          <button
            onClick={handleEmergencyPanic}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Lock className="w-4 h-4" />
            <span>TRIGGER EMERGENCY PANIC KILLSWITCH</span>
          </button>
        </div>
      </div>

      {/* Power Management Section */}
      <div className="bg-white/90 backdrop-blur-xl border border-black/5 rounded-3xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-900 mb-3 uppercase tracking-wider">
          pearOS Host Power Controls
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => handlePowerAction('lock')}
            className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl transition-all"
          >
            Lock Session
          </button>
          <button
            onClick={() => handlePowerAction('suspend')}
            className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl transition-all"
          >
            Sleep (Suspend)
          </button>
          <button
            onClick={() => handlePowerAction('reboot')}
            className="py-3 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-2xl transition-all"
          >
            Reboot Host
          </button>
          <button
            onClick={() => handlePowerAction('shutdown')}
            className="py-3 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold rounded-2xl transition-all"
          >
            Power Off
          </button>
        </div>
      </div>
    </div>
  );
};
