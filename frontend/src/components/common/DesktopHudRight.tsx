import React, { useState, useEffect } from 'react';
import {
  Cpu, HardDrive, Wifi, Shield, Terminal, Globe, QrCode,
  Moon, Sun, Lock, Camera, Volume2, VolumeX, Play, RotateCcw,
  RefreshCw, Check, Copy, ExternalLink, Activity
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { api } from '../../services/api';
import { GlobalAccessModal } from './GlobalAccessModal';

export const DesktopHudRight: React.FC = () => {
  const { systemInfo, addNotification, setActiveRoute } = useApp();
  const { systemStats, latencyMs } = useWebSocket();
  const [globalModalOpen, setGlobalModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const cpuPct = systemStats?.cpu_percent ?? 0;
  const memPct = systemStats?.memory_percent ?? 0;
  const diskPct = systemStats?.disk_percent ?? 0;
  const txRate = systemStats?.net_rate_tx_kbps ?? 0;
  const rxRate = systemStats?.net_rate_rx_kbps ?? 0;

  const handleQuickAction = async (action: string, label: string) => {
    setActionLoading(action);
    try {
      if (action === 'mute_audio') setAudioMuted(!audioMuted);
      await api.quickAction(action);
      addNotification('Executed Action', label, 'success');
    } catch (err: any) {
      addNotification('Action Failed', err.message || 'Execution error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const copyTunnelUrl = () => {
    if (systemInfo?.tunnel_url) {
      navigator.clipboard.writeText(systemInfo.tunnel_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const kaliTools = [
    { name: 'Terminal', cmd: 'x-terminal-emulator &', icon: Terminal, color: 'text-cyan-400' },
    { name: 'Wireshark', cmd: 'wireshark &', icon: Activity, color: 'text-blue-400' },
    { name: 'Nmap Quick', cmd: 'nmap -F 127.0.0.1', icon: Shield, color: 'text-emerald-400' },
    { name: 'Burp Suite', cmd: 'burpsuite &', icon: Shield, color: 'text-amber-400' },
  ];

  return (
    <aside className="w-80 h-full border-l border-slate-800/80 bg-slate-950/90 backdrop-blur-xl flex flex-col justify-between p-3.5 space-y-4 overflow-y-auto shrink-0 select-none hidden 2xl:flex shadow-2xl">
      
      {/* Top HUD Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
              KALI COMMAND HUD
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
            2.0 1080p
          </span>
        </div>

        {/* Global Access / Cloudflare Status Card */}
        <div className="p-3 bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Worldwide Access</span>
            </div>
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-400 rounded-full font-bold border border-emerald-500/30">
              {systemInfo?.tunnel_status === 'active' ? 'ONLINE' : 'ACTIVE'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
            <span>Ping Latency:</span>
            <span className="text-emerald-400 font-bold">{latencyMs}ms</span>
          </div>

          {systemInfo?.tunnel_url ? (
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono">
              <span className="flex-1 truncate px-1 text-cyan-300 select-all">{systemInfo.tunnel_url}</span>
              <button
                onClick={copyTunnelUrl}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Copy Global Link"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ) : null}

          <button
            onClick={() => setGlobalModalOpen(true)}
            className="w-full py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR & Tunnels</span>
          </button>
        </div>

        {/* Real-time Telemetry Meters */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Live Telemetry Gauges
          </span>

          {/* CPU Bar */}
          <div className="space-y-1 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> CPU Load
              </span>
              <span className="text-cyan-400 font-bold">{cpuPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, cpuPct))}%` }}
              />
            </div>
          </div>

          {/* Memory Bar */}
          <div className="space-y-1 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs font-mono">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" /> RAM Memory
              </span>
              <span className="text-purple-400 font-bold">{memPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, memPct))}%` }}
              />
            </div>
          </div>

          {/* Disk & Network Rate */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400">STORAGE</div>
              <div className="text-sm font-bold text-amber-400">{diskPct.toFixed(0)}%</div>
            </div>
            <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
              <div className="text-[10px] text-slate-400">NETWORK TX/RX</div>
              <div className="text-xs font-bold text-emerald-400">
                ↑{txRate.toFixed(0)} ↓{rxRate.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Kali Security Tools Launchers */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Security Tool Launchers
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {kaliTools.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.name}
                  onClick={() => {
                    setActiveRoute('/terminal');
                    addNotification('Tool Launcher', `Launched ${t.name}`, 'info');
                  }}
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-left transition-all flex items-center space-x-2"
                >
                  <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                  <span className="text-[11px] font-mono text-slate-200">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workstation Quick Power Deck */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Power &amp; Display Deck
        </span>
        <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
          <button
            onClick={() => handleQuickAction('sleep_display', 'Put display to sleep')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Sleep Display"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px]">Sleep</span>
          </button>

          <button
            onClick={() => handleQuickAction('wake_display', 'Woke workstation display')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Wake Display"
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px]">Wake</span>
          </button>

          <button
            onClick={() => handleQuickAction('lock_session', 'Locked Kali session')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Lock Kali Session"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px]">Lock</span>
          </button>

          <button
            onClick={() => handleQuickAction('screenshot', 'Captured desktop screenshot')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Capture Screenshot"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px]">Screen</span>
          </button>

          <button
            onClick={() => handleQuickAction('clear_cache', 'Flushed system RAM cache')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Flush System Cache"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px]">Purge</span>
          </button>

          <button
            onClick={() => handleQuickAction('mute_audio', 'Toggled Master Audio')}
            disabled={actionLoading !== null}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 flex flex-col items-center gap-1 active:scale-95 transition-all"
            title="Mute/Unmute Audio"
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="text-[10px]">{audioMuted ? 'Muted' : 'Mute'}</span>
          </button>
        </div>
      </div>

      {/* Global Access Modal */}
      <GlobalAccessModal
        isOpen={globalModalOpen}
        onClose={() => setGlobalModalOpen(false)}
      />
    </aside>
  );
};

export default DesktopHudRight;
