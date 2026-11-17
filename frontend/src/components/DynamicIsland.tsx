import React, { useState, useEffect } from 'react';
import { Cpu, Battery, BatteryCharging, Lock, VolumeX, ShieldAlert, Sparkles, RefreshCw, X, Clock } from 'lucide-react';
import { api } from '../services/api';

export const DynamicIsland: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [status, setStatus] = useState<any>({
    cpu_percent: 18.4,
    memory_percent: 42.1,
    battery_percent: 100,
    power_plugged: true,
    media: { title: 'pearOS Nexus', artist: 'Engine', playing: true }
  });
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getDynamicIslandStatus();
        if (data.success) {
          setStatus(data);
        }
      } catch (err) {
        // keep fallback
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerHeight < 550);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Landscape StandBy Desk Clock Mode
  if (isLandscape) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-around p-8 select-none">
        <div className="flex flex-col items-center">
          <span className="text-8xl font-thin tracking-tighter text-apple-blue font-mono">{currentTime}</span>
          <span className="text-xs uppercase tracking-widest text-slate-400 mt-2">pearOS StandBy Desk Mode</span>
        </div>
        <div className="flex flex-col gap-4 bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/10 w-80">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-300 flex items-center gap-2"><Cpu size={16} className="text-apple-blue" /> CPU Load</span>
            <span className="font-semibold">{status.cpu_percent}%</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-apple-blue h-full transition-all duration-500" style={{ width: `${status.cpu_percent}%` }}></div>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-slate-300 flex items-center gap-2">
              {status.power_plugged ? <BatteryCharging size={16} className="text-apple-green" /> : <Battery size={16} />} Battery
            </span>
            <span className="font-semibold">{status.battery_percent}%</span>
          </div>
          <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="bg-apple-green h-full transition-all duration-500" style={{ width: `${status.battery_percent}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out">
      {!expanded ? (
        // Compact Pill Mode
        <div
          onClick={() => setExpanded(true)}
          className="glass-dark text-white px-4 py-2 rounded-full flex items-center gap-3 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-apple-green animate-pulse"></span>
            <span className="text-xs font-semibold tracking-wide">pearOS</span>
          </div>
          <div className="h-3 w-[1px] bg-white/20"></div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
            <Cpu size={12} className="text-apple-blue" />
            <span>{status.cpu_percent}%</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
            {status.power_plugged ? <BatteryCharging size={12} className="text-apple-green" /> : <Battery size={12} />}
            <span>{status.battery_percent}%</span>
          </div>
        </div>
      ) : (
        // Expanded Card Mode
        <div className="glass-dark text-white p-5 rounded-3xl w-[350px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-apple-green animate-ping"></span>
              <span className="font-semibold text-sm">pearOS Nexus 3.0</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Telemetry Dials */}
          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">CPU Load</span>
              <span className="text-2xl font-bold font-mono text-apple-blue">{status.cpu_percent}%</span>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-apple-blue h-full" style={{ width: `${status.cpu_percent}%` }}></div>
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-xs text-slate-400 block mb-1">RAM In-Use</span>
              <span className="text-2xl font-bold font-mono text-apple-purple">{status.memory_percent}%</span>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-apple-purple h-full" style={{ width: `${status.memory_percent}%` }}></div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              onClick={async () => {
                await api.lockScreen();
                setExpanded(false);
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            >
              <Lock size={16} className="text-apple-blue mb-1" />
              <span className="text-[10px] font-medium">Lock</span>
            </button>
            <button
              onClick={async () => {
                await api.clearRam();
                alert("RAM buffers synced & cache cleared");
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            >
              <RefreshCw size={16} className="text-apple-green mb-1" />
              <span className="text-[10px] font-medium">Purge RAM</span>
            </button>
            <button
              onClick={async () => {
                await api.sendShortcut("XF86AudioMute");
              }}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
            >
              <VolumeX size={16} className="text-apple-red mb-1" />
              <span className="text-[10px] font-medium">Mute</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
