import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Lock, VolumeX, RefreshCw, X, Activity } from 'lucide-react';
import { api } from '../services/api';

export const DynamicIsland: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [status, setStatus] = useState<any>({
    cpu_percent: 14.2,
    memory_percent: 42.0,
    battery_percent: 100,
    power_plugged: true
  });
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getDynamicIslandStatus();
        if (data.success) setStatus(data);
      } catch (_e) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerHeight < 520);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Landscape StandBy Crystal Clock Mode
  if (isLandscape) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0b0e18]/95 backdrop-blur-3xl text-stitch-text flex items-center justify-around p-8 select-none">
        <div className="flex flex-col items-center">
          <span className="text-8xl font-display font-bold tracking-tighter text-stitch-primary drop-shadow-[0_0_30px_rgba(62,144,255,0.45)] font-mono">
            {currentTime}
          </span>
          <span className="text-xs uppercase tracking-[0.25em] text-stitch-muted mt-2">
            pearOS Liquid StandBy
          </span>
        </div>
        <div className="liquid-glass p-6 rounded-3xl w-80 flex flex-col gap-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-stitch-muted flex items-center gap-2">
              <Cpu size={16} className="text-stitch-primary" /> CPU Core
            </span>
            <span className="font-mono font-semibold text-stitch-primary">{status.cpu_percent}%</span>
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-stitch-primaryStrong to-stitch-primary h-full transition-all duration-500"
              style={{ width: `${Math.min(100, status.cpu_percent)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-stitch-muted flex items-center gap-2">
              <Activity size={16} className="text-stitch-tertiary" /> Memory
            </span>
            <span className="font-mono font-semibold text-stitch-tertiary">{status.memory_percent}%</span>
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-stitch-tertiaryStrong to-stitch-tertiary h-full transition-all duration-500"
              style={{ width: `${Math.min(100, status.memory_percent)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className="w-full px-3 pt-2.5 pb-1 flex justify-center relative z-40">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand pearOS Dynamic Island"
          className="w-full max-w-md liquid-pill rounded-full px-2.5 py-1.5 flex items-center justify-between gap-2 transition-all active:scale-[0.98]"
        >
          {/* Left: pearOS Core Status */}
          <div className="flex items-center gap-2 pl-0.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/15 text-stitch-primary">
              <span className="text-sm">🍐</span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-stitch-secondary shadow-[0_0_10px_#47e266] animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-stitch-secondary" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display text-xs font-bold text-stitch-text tracking-tight leading-tight">
                pearOS Nexus
              </span>
              <span className="font-mono text-[9px] text-stitch-secondary tracking-widest uppercase">
                Core Synced
              </span>
            </div>
          </div>

          {/* Right: Telemetry Vital Chips */}
          <div className="flex items-center gap-1.5 pr-0.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full liquid-glass-deep">
              <span className="font-mono text-[9px] text-stitch-outline">CPU</span>
              <div className="w-6 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                <div className="h-full bg-stitch-primary rounded-full" style={{ width: `${Math.min(100, status.cpu_percent)}%` }} />
              </div>
              <span className="font-mono text-[10px] font-semibold text-stitch-primary">{status.cpu_percent}%</span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full liquid-glass-deep">
              <span className="font-mono text-[9px] text-stitch-outline">RAM</span>
              <span className="font-mono text-[10px] font-semibold text-stitch-tertiary">{status.memory_percent}%</span>
            </div>

            <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-stitch-secondaryStrong/20 border border-stitch-secondary/30 text-stitch-secondary">
              <Zap size={11} className="animate-pulse" />
              <span className="font-mono text-[10px] font-semibold">
                {status.battery_percent > 0 ? `${status.battery_percent}%` : 'AC'}
              </span>
            </div>
          </div>
        </button>
      ) : (
        <div className="w-full max-w-md liquid-glass rounded-3xl p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-stitch-secondary shadow-[0_0_10px_#47e266]" />
              <span className="font-display font-bold text-sm text-stitch-text">pearOS Nexus 4.0 Glass</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close Dynamic Island"
              className="w-8 h-8 rounded-full liquid-btn flex items-center justify-center text-stitch-muted"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 my-3.5">
            <div className="liquid-glass-deep p-3 rounded-2xl">
              <span className="text-[10px] font-mono uppercase text-stitch-outline block">CPU Load</span>
              <span className="text-2xl font-bold font-mono text-stitch-primary">{status.cpu_percent}%</span>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-stitch-primaryStrong h-full rounded-full" style={{ width: `${Math.min(100, status.cpu_percent)}%` }} />
              </div>
            </div>
            <div className="liquid-glass-deep p-3 rounded-2xl">
              <span className="text-[10px] font-mono uppercase text-stitch-outline block">RAM Usage</span>
              <span className="text-2xl font-bold font-mono text-stitch-tertiary">{status.memory_percent}%</span>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-stitch-tertiaryStrong h-full rounded-full" style={{ width: `${Math.min(100, status.memory_percent)}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={async () => {
                await api.lockScreen();
                setExpanded(false);
              }}
              className="liquid-btn rounded-2xl py-2.5 flex flex-col items-center gap-1"
            >
              <Lock size={16} className="text-stitch-primary" />
              <span className="text-[11px] font-medium text-stitch-text">Lock PC</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await api.clearRam();
                setExpanded(false);
              }}
              className="liquid-btn rounded-2xl py-2.5 flex flex-col items-center gap-1"
            >
              <RefreshCw size={16} className="text-stitch-secondary" />
              <span className="text-[11px] font-medium text-stitch-text">Purge RAM</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await api.sendShortcut('XF86AudioMute');
              }}
              className="liquid-btn rounded-2xl py-2.5 flex flex-col items-center gap-1"
            >
              <VolumeX size={16} className="text-stitch-error" />
              <span className="text-[11px] font-medium text-stitch-text">Mute</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
