import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Activity, Cpu, Battery, Wifi, Music, Volume2, ShieldAlert, 
  Moon, CheckCircle2, AlertTriangle, Maximize2, Minimize2, Sparkles
} from 'lucide-react';

interface DynamicIslandProps {
  onOpenControlCenter?: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ onOpenControlCenter }) => {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<{
    cpu_percent: number;
    memory_percent: number;
    battery_percent: number;
    power_plugged: boolean;
    media: { title: string; artist: string; playing: boolean; progress_pct: number };
    alert?: { type: string; text: string };
  }>({
    cpu_percent: 18,
    memory_percent: 42,
    battery_percent: 94,
    power_plugged: true,
    media: { title: 'pearOS Ambient Stream', artist: 'System Audio', playing: true, progress_pct: 45 }
  });

  const [deskMode, setDeskMode] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.getDynamicIslandStatus();
        if (res.success) {
          setData(res as any);
        }
      } catch (e) {
        // Fallback smooth mock
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Desk Mode auto-detect on landscape
  useEffect(() => {
    const checkOrientation = () => {
      if (window.innerWidth > window.innerHeight && window.innerHeight < 550) {
        setDeskMode(true);
      } else {
        setDeskMode(false);
      }
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (deskMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-6 select-none animate-fadeIn">
        <div className="flex justify-between items-center text-xs tracking-wider uppercase text-neutral-400">
          <span className="flex items-center gap-1.5 font-medium"><Sparkles size={14} className="text-amber-400" /> pearOS StandBy Desk Mode</span>
          <button 
            onClick={() => setDeskMode(false)}
            className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 hover:text-white"
          >
            Exit StandBy
          </button>
        </div>
        <div className="flex items-center justify-between my-auto">
          <div>
            <div className="text-7xl font-extralight tracking-tight font-mono text-white">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-neutral-400 mt-1">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center w-28">
              <Cpu size={22} className="text-blue-400 mb-1" />
              <div className="text-lg font-semibold">{data.cpu_percent.toFixed(0)}%</div>
              <div className="text-[10px] text-neutral-400 uppercase">CPU Load</div>
            </div>
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center w-28">
              <Battery size={22} className="text-emerald-400 mb-1" />
              <div className="text-lg font-semibold">{data.battery_percent}%</div>
              <div className="text-[10px] text-neutral-400 uppercase">Battery</div>
            </div>
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center w-28">
              <Music size={22} className="text-purple-400 mb-1" />
              <div className="text-xs font-medium truncate max-w-[90px]">{data.media.title}</div>
              <div className="text-[10px] text-neutral-400 uppercase">Audio</div>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-neutral-500">
          pearOS Smart Remote • In-Memory Zero-Disk Continuity
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-spring">
      <div 
        onClick={() => setExpanded(!expanded)}
        className={`bg-black text-white rounded-full shadow-2xl border border-white/10 cursor-pointer transition-all duration-300 ease-out select-none flex items-center overflow-hidden ${
          expanded 
            ? 'w-[90vw] max-w-[380px] rounded-3xl p-4 flex-col' 
            : 'h-9 px-3.5 gap-2.5 w-auto'
        }`}
      >
        {!expanded ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-tight text-neutral-200">pearOS</span>
            </div>

            <div className="h-3 w-px bg-white/20" />

            <div className="flex items-center gap-1.5 text-xs text-neutral-300">
              <Cpu size={12} className="text-blue-400" />
              <span className="text-[11px] font-mono">{data.cpu_percent.toFixed(0)}%</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-300">
              <Battery size={12} className={data.battery_percent > 20 ? 'text-emerald-400' : 'text-red-400'} />
              <span className="text-[11px] font-mono">{data.battery_percent}%</span>
            </div>

            {data.media.playing && (
              <div className="flex items-center gap-1 ml-1 text-purple-400">
                <Music size={11} className="animate-bounce" />
                <span className="text-[10px] font-medium max-w-[70px] truncate text-neutral-300">{data.media.title}</span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold text-white">Dynamic Island Live</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                macOS Sequoia
              </span>
            </div>

            {/* Media Bar */}
            <div className="bg-neutral-900/90 rounded-2xl p-3 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-md">
                  <Music size={18} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{data.media.title}</div>
                  <div className="text-[10px] text-neutral-400">{data.media.artist}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" />
                <div className="w-1 h-5 bg-purple-400 rounded-full animate-pulse delay-75" />
                <div className="w-1 h-2 bg-purple-400 rounded-full animate-pulse delay-150" />
              </div>
            </div>

            {/* Quick Gauges */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-neutral-900/80 rounded-xl p-2 border border-white/5">
                <div className="text-[10px] text-neutral-400 uppercase">CPU</div>
                <div className="font-semibold text-sm text-blue-400 mt-0.5">{data.cpu_percent.toFixed(0)}%</div>
              </div>
              <div className="bg-neutral-900/80 rounded-xl p-2 border border-white/5">
                <div className="text-[10px] text-neutral-400 uppercase">RAM</div>
                <div className="font-semibold text-sm text-emerald-400 mt-0.5">{data.memory_percent.toFixed(0)}%</div>
              </div>
              <div className="bg-neutral-900/80 rounded-xl p-2 border border-white/5">
                <div className="text-[10px] text-neutral-400 uppercase">Battery</div>
                <div className="font-semibold text-sm text-amber-400 mt-0.5">{data.battery_percent}%</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenControlCenter?.();
                  setExpanded(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
              >
                Control Center
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setDeskMode(true);
                  setExpanded(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition-colors flex items-center gap-1"
              >
                <Moon size={12} /> StandBy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
