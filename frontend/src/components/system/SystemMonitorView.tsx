import React, { useState } from 'react';
import {
  Cpu, HardDrive, Wifi, Lock, LogOut, Power, RotateCcw,
  PauseCircle, Thermometer, Battery, Activity, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { ProcessManager } from './ProcessManager';

export const SystemMonitorView: React.FC = () => {
  const { systemStats } = useWebSocket();
  const { systemInfo, addNotification } = useApp();
  const [powerActionTarget, setPowerActionTarget] = useState<string | null>(null);

  const handleExecutePower = async () => {
    if (!powerActionTarget) return;
    try {
      await api.powerAction(powerActionTarget, true);
      addNotification('Power Command Sent', `Executed ${powerActionTarget}`, 'success');
      setPowerActionTarget(null);
    } catch (err: any) {
      addNotification('Power Action Failed', err.message, 'error');
    }
  };

  const formatBytes = (b?: number) => {
    if (!b) return '0 B';
    const gb = b / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="flex flex-col space-y-4 p-4 max-w-6xl mx-auto w-full select-none overflow-y-auto pb-20">
      {/* Top Telemetry Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-cyber-border pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>SYSTEM CONTROL CENTER</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {systemInfo?.hostname} • {systemInfo?.os_name} • Uptime: {systemInfo?.uptime_human}
          </p>
        </div>

        {/* Power Action Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setPowerActionTarget('lock')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            title="Lock Screen"
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPowerActionTarget('logout')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400"
            title="Log Out Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPowerActionTarget('suspend')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-purple-400"
            title="Suspend Machine"
          >
            <PauseCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPowerActionTarget('reboot')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400"
            title="Restart Workstation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPowerActionTarget('shutdown')}
            className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-400"
            title="Shutdown Workstation"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Stat Gauges Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU Card */}
        <div className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">CPU USAGE</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.cpu_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, systemStats?.cpu_percent || 0)}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            {systemStats?.cpu_cores || 1} Cores @ {systemStats?.cpu_freq_mhz ? `${systemStats.cpu_freq_mhz.toFixed(0)} MHz` : 'Dynamic'}
          </div>
        </div>

        {/* Memory Card */}
        <div className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">MEMORY (RAM)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.memory_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, systemStats?.memory_percent || 0)}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            {formatBytes(systemStats?.memory_used_bytes)} / {formatBytes(systemStats?.memory_total_bytes)}
          </div>
        </div>

        {/* Disk Card */}
        <div className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">STORAGE ROOT</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {systemStats?.disk_percent.toFixed(1) || '0.0'}%
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, systemStats?.disk_percent || 0)}%` }}
            />
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            {formatBytes(systemStats?.disk_used_bytes)} / {formatBytes(systemStats?.disk_total_bytes)}
          </div>
        </div>

        {/* Network Card */}
        <div className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">NETWORK I/O</span>
            <Wifi className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100 flex flex-col space-y-0.5">
            <span className="text-emerald-400">TX: {systemStats?.net_rate_tx_kbps || 0} kbps</span>
            <span className="text-cyan-400">RX: {systemStats?.net_rate_rx_kbps || 0} kbps</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 pt-1">
            Tailscale IP: {systemInfo?.tailscale_ip}
          </div>
        </div>
      </div>

      {/* Secondary Sensor Cards (Temp & Battery if available) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {systemStats?.temperature_celsius && (
          <div className="p-3 bg-cyber-surface border border-slate-800 rounded-xl flex items-center space-x-3">
            <Thermometer className="w-5 h-5 text-rose-400" />
            <div>
              <div className="text-xs text-slate-400 font-mono">CPU Core Temperature</div>
              <div className="text-sm font-bold font-mono text-slate-100">{systemStats.temperature_celsius}°C</div>
            </div>
          </div>
        )}
        {systemStats?.battery_percent !== null && systemStats?.battery_percent !== undefined && (
          <div className="p-3 bg-cyber-surface border border-slate-800 rounded-xl flex items-center space-x-3">
            <Battery className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-400 font-mono">Workstation Battery</div>
              <div className="text-sm font-bold font-mono text-slate-100">
                {systemStats.battery_percent}% {systemStats.battery_plugged ? '(Plugged In)' : '(On Battery)'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Process Manager Sub-module */}
      <ProcessManager />

      {/* Power Confirmation Dialog */}
      {powerActionTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-cyber-surface border border-rose-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-sm uppercase tracking-wide">Confirm Power Action</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to execute <strong className="text-rose-300 uppercase">{powerActionTarget}</strong> on your Kali machine?
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={handleExecutePower}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
              >
                Confirm {powerActionTarget}
              </button>
              <button
                onClick={() => setPowerActionTarget(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
