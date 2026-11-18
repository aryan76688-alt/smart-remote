import React, { useState, useEffect } from 'react';
import { Lock, VolumeX, RefreshCw, X } from 'lucide-react';
import { api } from '../services/api';

interface DynamicIslandProps {
  activeTabLabel: string;
}

type GlassMode = 'crystal' | 'balanced' | 'frosted';

const formatClock = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ activeTabLabel }) => {
  const [expanded, setExpanded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [glassMode, setGlassMode] = useState<GlassMode>('crystal');
  const [status, setStatus] = useState<any>({
    cpu_percent: 14.0,
    memory_percent: 42.0,
    battery_percent: 100,
    power_plugged: true,
    recorder: { recording: true, always_on: true, elapsed_seconds: 0, source: 'laptop' }
  });
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Apply crystal-clear transparent glass mode on root
  useEffect(() => {
    document.documentElement.setAttribute('data-glass-mode', glassMode);
  }, [glassMode]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getDynamicIslandStatus();
        if (data.success) setStatus(data);
      } catch (_e) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerHeight < 500);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  if (isLandscape) {
    return (
      <div className="fixed inset-0 z-50 bg-white/15 backdrop-blur-2xl text-apple-ink flex items-center justify-around p-10 select-none">
        <div className="flex flex-col items-start">
          <span className="font-display font-semibold text-[72px] leading-none tracking-[-0.03em] text-apple-ink font-mono">
            {currentTime}
          </span>
          <span className="type-caption text-apple-ink80 mt-3">
            pearOS Crystal Glass StandBy
          </span>
        </div>
        <div className="apple-glass-card p-6 w-80 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="type-caption text-apple-ink80">CPU Load</span>
            <span className="type-body-strong font-mono text-apple-ink">{status.cpu_percent}%</span>
          </div>
          <div className="w-full bg-white/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-apple-primary h-full transition-all" style={{ width: `${Math.min(100, status.cpu_percent)}%` }} />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="type-caption text-apple-ink80">Memory</span>
            <span className="type-body-strong font-mono text-apple-ink">{status.memory_percent}%</span>
          </div>
          <div className="w-full bg-white/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-apple-ink h-full transition-all" style={{ width: `${Math.min(100, status.memory_percent)}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const rec = status.recorder;

  return (
    <header className="w-full apple-glass-nav relative z-40 shrink-0">
      <div className="max-w-[980px] mx-auto h-[52px] px-4 flex items-center justify-between gap-2">
        {/* Left: Category Tagline + Live 24/7 REC Pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="type-tagline text-apple-ink truncate">{activeTabLabel}</h1>

          {rec?.recording && (
            <span className="apple-glass-floating rounded-full px-2.5 py-1 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-apple-rec animate-ping" />
              <span className="type-micro font-mono font-semibold text-apple-ink">
                24/7 REC {formatClock(rec.elapsed_seconds || 0)}
              </span>
            </span>
          )}
        </div>

        {/* Right: Telemetry + Controls CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="type-fine font-mono text-apple-ink80 hidden sm:inline">
            CPU {status.cpu_percent}% · RAM {status.memory_percent}%
          </span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="apple-btn-primary px-4 py-1.5 type-caption min-h-[34px] flex items-center gap-1"
          >
            {expanded ? 'Done' : 'Controls'}
          </button>
        </div>
      </div>

      {/* Expandable Transparent Controls & Transparency Mode Tray */}
      {expanded && (
        <div className="max-w-[980px] mx-auto px-4 pb-4 pt-1">
          <div className="apple-glass-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/50 pb-3">
              <div>
                <p className="type-body-strong text-apple-ink">pearOS Transparent Glass Controls</p>
                <p className="type-fine text-apple-ink80 mt-0.5">
                  Power: {status.power_plugged ? 'Connected' : `${status.battery_percent}%`} · 24/7 Recording: {rec?.recording ? 'Active' : 'Paused'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close Controls"
                className="apple-glass-chip w-9 h-9 rounded-full flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Live Transparency Level Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="type-caption-strong text-apple-ink">Glass Transparency</span>
              <div className="flex items-center gap-1.5">
                {([
                  { id: 'crystal', label: 'Crystal Clear' },
                  { id: 'balanced', label: 'Liquid Glass' },
                  { id: 'frosted', label: 'Frosted' },
                ] as { id: GlassMode; label: string }[]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGlassMode(m.id)}
                    className={`px-3.5 py-1.5 type-fine ${
                      glassMode === m.id ? 'apple-option-chip-selected font-semibold' : 'apple-option-chip'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="apple-glass-well rounded-apple-lg p-4">
                <span className="type-fine text-apple-ink80 block">CPU Utilization</span>
                <span className="type-display-lg font-mono text-apple-ink">{status.cpu_percent}%</span>
                <div className="w-full bg-white/50 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-apple-primary h-full" style={{ width: `${Math.min(100, status.cpu_percent)}%` }} />
                </div>
              </div>
              <div className="apple-glass-well rounded-apple-lg p-4">
                <span className="type-fine text-apple-ink80 block">Memory Used</span>
                <span className="type-display-lg font-mono text-apple-ink">{status.memory_percent}%</span>
                <div className="w-full bg-white/50 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-apple-ink h-full" style={{ width: `${Math.min(100, status.memory_percent)}%` }} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => { await api.lockScreen(); setExpanded(false); }}
                className="apple-btn-primary px-5 py-2.5 type-caption flex items-center gap-1.5"
              >
                <Lock size={14} />
                <span>Lock pearOS</span>
              </button>
              <button
                type="button"
                onClick={async () => { await api.clearRam(); setExpanded(false); }}
                className="apple-btn-secondary px-5 py-2.5 type-caption flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                <span>Purge RAM</span>
              </button>
              <button
                type="button"
                onClick={() => api.sendShortcut('XF86AudioMute')}
                className="apple-btn-pearl px-4 py-2 type-caption flex items-center gap-1.5"
              >
                <VolumeX size={14} />
                <span>Mute Audio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
