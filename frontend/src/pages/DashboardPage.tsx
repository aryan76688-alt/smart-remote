import React, { useState } from 'react';
import {
  Terminal, Monitor, Gamepad2, Folder, Cpu, Bot, Tv, Camera,
  Lock, RotateCcw, Power, Wifi, HardDrive, Activity, ArrowRight, Mic,
  Globe, QrCode, Smartphone, ShieldAlert, Upload, Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useVoice } from '../context/VoiceContext';
import { api } from '../services/api';
import { GlobalAccessModal } from '../components/common/GlobalAccessModal';
import { SirenModal } from '../components/intercom/SirenModal';
import { QuickDropModal } from '../components/productivity/QuickDropModal';
import { ClipboardSyncCard } from '../components/productivity/ClipboardSyncCard';
import { BatteryHealthCard } from '../components/productivity/BatteryHealthCard';

export const DashboardPage: React.FC = () => {
  const { setActiveRoute, systemInfo, tailscaleIp, addNotification, isApk } = useApp();
  const { systemStats, latencyMs } = useWebSocket();
  const { startListening } = useVoice();
  const [showGlobalModal, setShowGlobalModal] = useState<boolean>(false);
  const [showSirenModal, setShowSirenModal] = useState<boolean>(false);
  const [showQuickDrop, setShowQuickDrop] = useState<boolean>(false);

  const takeQuickScreenshot = async () => {
    try {
      addNotification('Screenshot', 'Capturing Kali display...', 'info');
      const blob = await fetch('/api/remote/screenshot').then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kali-screen-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('Screenshot', 'Saved screenshot.', 'success');
    } catch {
      addNotification('Screenshot', 'Failed to capture screenshot.', 'error');
    }
  };

  const quickActions = [
    { label: '🚨 Siren Alarm', icon: ShieldAlert, action: () => setShowSirenModal(true), color: 'text-rose-500' },
    { label: 'Quick Drop', icon: Upload, action: () => setShowQuickDrop(true), color: 'text-cyan-400' },
    { label: 'AI Brain', icon: Sparkles, action: () => setActiveRoute('/settings'), color: 'text-purple-400' },
    { label: 'Open Terminal', icon: Terminal, action: () => setActiveRoute('/terminal'), color: 'text-cyan-400' },
    { label: 'Screen Mirror', icon: Monitor, action: () => setActiveRoute('/mirror'), color: 'text-emerald-400' },
    { label: 'Touchpad', icon: Gamepad2, action: () => setActiveRoute('/remote'), color: 'text-purple-400' },
    { label: 'File Manager', icon: Folder, action: () => setActiveRoute('/files'), color: 'text-amber-400' },
    { label: 'System Center', icon: Cpu, action: () => setActiveRoute('/system'), color: 'text-rose-400' },
    { label: 'AI Assistant', icon: Bot, action: () => setActiveRoute('/assistant'), color: 'text-cyan-300' },
    { label: 'Voice Trigger', icon: Mic, action: startListening, color: 'text-emerald-300' },
    ...(!isApk ? [{ label: 'Android APK', icon: Smartphone, action: () => { window.location.href = '/SmartRemote.apk'; }, color: 'text-cyan-400' }] : []),
    { label: 'Media Remote', icon: Tv, action: () => setActiveRoute('/media'), color: 'text-blue-400' },
    { label: 'Screenshot', icon: Camera, action: takeQuickScreenshot, color: 'text-slate-300' },
    { label: 'Lock Screen', icon: Lock, action: () => api.powerAction('lock'), color: 'text-amber-300' },
    { label: 'Reboot Host', icon: RotateCcw, action: () => setActiveRoute('/system'), color: 'text-rose-400' },
    { label: 'Shutdown', icon: Power, action: () => setActiveRoute('/system'), color: 'text-rose-500' },
  ];

  return (
    <div className="flex flex-col space-y-5 p-4 max-w-6xl mx-auto w-full select-none overflow-y-auto pb-24">
      {/* Android Native APK Card - Shown only for Web users */}
      {!isApk && (
        <div className="p-4 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/40 border border-cyan-400/60 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-400/50 text-cyan-300 shrink-0">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100">Android Native App</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  OFFICIAL .APK
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Install the mobile app for low-latency control, hardware acceleration, and full phone microphone intercom.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 text-xs font-black tracking-wider uppercase active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 shrink-0"
            >
              <Smartphone className="w-4 h-4" />
              <span>DOWNLOAD ANDROID APK</span>
            </a>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-cyan-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>KALI WORKSTATION • TAILSCALE ACTIVE</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
              {systemInfo?.hostname || 'kali'}
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              {systemInfo?.os_name} • Kernel {systemInfo?.kernel_version} • Uptime {systemInfo?.uptime_human}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveRoute('/terminal')}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-semibold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
            >
              <Terminal className="w-4 h-4" />
              <span>Launch Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveRoute('/mirror')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center space-x-2 active:scale-95 transition-all"
            >
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>Live Mirror</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Access Hero Card */}
      <div className="p-4 bg-gradient-to-r from-slate-900/90 via-cyan-950/25 to-slate-900/90 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Globe className="w-5 h-5 animate-spin-slow" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100">Global Access Anywhere</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                NO TAILSCALE REQUIRED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Access SMART REMOTE securely on Samsung Galaxy A36 or any phone on 4G/5G mobile data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowGlobalModal(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR / Connect</span>
          </button>
        </div>
      </div>

      {/* Real-Time Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveRoute('/system')}
          className="p-4 bg-cyber-surface border border-slate-800 hover:border-cyan-500/50 rounded-2xl cursor-pointer space-y-2 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>CPU</span>
            <Cpu className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.cpu_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, systemStats?.cpu_percent || 0)}%` }}
            />
          </div>
        </div>

        <div
          onClick={() => setActiveRoute('/system')}
          className="p-4 bg-cyber-surface border border-slate-800 hover:border-emerald-500/50 rounded-2xl cursor-pointer space-y-2 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>MEMORY</span>
            <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.memory_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, systemStats?.memory_percent || 0)}%` }}
            />
          </div>
        </div>

        <div
          onClick={() => setActiveRoute('/files')}
          className="p-4 bg-cyber-surface border border-slate-800 hover:border-purple-500/50 rounded-2xl cursor-pointer space-y-2 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>DISK</span>
            <HardDrive className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.disk_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, systemStats?.disk_percent || 0)}%` }}
            />
          </div>
        </div>

        <div
          onClick={() => setActiveRoute('/devices')}
          className="p-4 bg-cyber-surface border border-slate-800 hover:border-amber-500/50 rounded-2xl cursor-pointer space-y-2 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TAILSCALE</span>
            <Wifi className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100 truncate">
            {tailscaleIp}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Latency: <span className="text-emerald-400">{latencyMs}ms</span>
          </div>
        </div>
      </div>

      {/* Hardware Health & Universal Clipboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BatteryHealthCard />
        <ClipboardSyncCard />
      </div>

      {/* Quick Action Matrix */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Quick Workstation Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {quickActions.map(qa => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.label}
                onClick={qa.action}
                className="p-3.5 rounded-2xl bg-cyber-surface border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-850 flex flex-col items-center justify-center space-y-2 text-center transition-all active:scale-95 shadow-sm"
              >
                <div className="p-2 rounded-xl bg-slate-900">
                  <Icon className={`w-5 h-5 ${qa.color}`} />
                </div>
                <span className="text-xs font-medium text-slate-200">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Access Modal */}
      <GlobalAccessModal
        isOpen={showGlobalModal}
        onClose={() => setShowGlobalModal(false)}
      />

      {/* Emergency Siren & Intercom Modal */}
      <SirenModal
        isOpen={showSirenModal}
        onClose={() => setShowSirenModal(false)}
      />

      {/* Quick Drop Modal */}
      <QuickDropModal
        isOpen={showQuickDrop}
        onClose={() => setShowQuickDrop(false)}
      />
    </div>
  );
};
