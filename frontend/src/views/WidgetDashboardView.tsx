import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Cpu, Battery, Music, Shield, StickyNote, Activity, Wifi, Play, Pause, 
  RotateCcw, Sparkles, Plus, Trash2, CheckCircle2, ChevronRight, Gauge
} from 'lucide-react';

export const WidgetDashboardView: React.FC = () => {
  const [cpuStats, setCpuStats] = useState({ cpu: 22, ram: 45, temp: 48 });
  const [batteryInfo, setBatteryInfo] = useState({ pct: 88, health: 96, limit: 80 });
  const [quickNotes, setQuickNotes] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [speedResult, setSpeedResult] = useState<{ download: number; ping: number } | null>(null);
  const [testingSpeed, setTestingSpeed] = useState(false);
  const [radarDevices, setRadarDevices] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch
    const loadWidgets = async () => {
      try {
        const [bat, notes, radar] = await Promise.all([
          api.getBatteryGuardian().catch(() => null),
          api.getQuickNotes().catch(() => null),
          api.getDeviceRadar().catch(() => null)
        ]);

        if (bat && bat.success) {
          setBatteryInfo({ pct: bat.percentage, health: bat.health_score, limit: bat.charge_limit_percent });
        }
        if (notes && notes.success) {
          setQuickNotes(notes.notes || []);
        }
        if (radar && radar.success) {
          setRadarDevices(radar.devices || []);
        }
      } catch (e) {
        // Fallback
      }
    };
    loadWidgets();
  }, []);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    try {
      const res = await api.saveQuickNote('Quick Memo', newNoteText.trim());
      if (res.success && res.note) {
        setQuickNotes([res.note, ...quickNotes]);
        setNewNoteText('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeedtest = async () => {
    setTestingSpeed(true);
    try {
      const res = await api.runSpeedtest();
      if (res.success) {
        setSpeedResult({ download: res.download_mbps, ping: res.latency_ms });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestingSpeed(false);
    }
  };

  return (
    <div className="space-y-4 select-none pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            iOS 18 Widget Dashboard
          </h2>
          <p className="text-xs text-neutral-500">pearOS Smart Remote Continuity Hub</p>
        </div>
        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          Zero Disk RAM
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Widget 1: System Vitals Dial */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-neutral-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-blue-500" /> System Engine
            </span>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Optimal</span>
          </div>
          <div className="flex items-center justify-around py-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-900 font-mono">{cpuStats.cpu}%</div>
              <div className="text-[10px] text-neutral-400 uppercase mt-0.5">CPU Load</div>
            </div>
            <div className="h-8 w-px bg-neutral-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-900 font-mono">{cpuStats.ram}%</div>
              <div className="text-[10px] text-neutral-400 uppercase mt-0.5">RAM Used</div>
            </div>
            <div className="h-8 w-px bg-neutral-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-900 font-mono">{cpuStats.temp}°C</div>
              <div className="text-[10px] text-neutral-400 uppercase mt-0.5">Thermals</div>
            </div>
          </div>
        </div>

        {/* Widget 2: Battery Guardian */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-neutral-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Battery size={14} className="text-emerald-500" /> Battery Guardian
            </span>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">Cap: {batteryInfo.limit}%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-3xl font-bold text-neutral-900 font-mono">{batteryInfo.pct}%</div>
              <div className="text-xs text-neutral-500">Lithium Health: {batteryInfo.health}%</div>
            </div>
            <div className="text-right">
              <button 
                onClick={async () => {
                  const newLimit = batteryInfo.limit === 80 ? 100 : 80;
                  await api.setBatteryChargeLimit(newLimit);
                  setBatteryInfo({ ...batteryInfo, limit: newLimit });
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-700 transition-colors"
              >
                Toggle {batteryInfo.limit === 80 ? '100%' : '80%'}
              </button>
            </div>
          </div>
        </div>

        {/* Widget 3: Quick Notes & Sticky Sync */}
        <div className="bg-amber-50/70 backdrop-blur-md rounded-2xl p-4 border border-amber-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <StickyNote size={14} className="text-amber-600" /> In-Memory Sticky Notes
            </span>
            <span className="text-[10px] text-amber-700 font-medium">{quickNotes.length} Memos</span>
          </div>
          <div className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar py-1">
            {quickNotes.map((note) => (
              <div key={note.id} className="text-xs text-neutral-800 bg-white/60 p-2 rounded-lg border border-amber-200/50 flex justify-between items-start">
                <span className="line-clamp-2">{note.content}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input 
              type="text"
              placeholder="Type quick memo..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              className="flex-1 bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button 
              onClick={handleAddNote}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium"
            >
              Add
            </button>
          </div>
        </div>

        {/* Widget 4: SpeedTest & Bandwidth Stresser */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-neutral-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge size={14} className="text-purple-500" /> Tailscale SpeedTest
            </span>
            <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">Encrypted</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-2xl font-bold text-neutral-900 font-mono">
                {speedResult ? `${speedResult.download} Mbps` : 'Ready'}
              </div>
              <div className="text-xs text-neutral-400">
                {speedResult ? `Ping: ${speedResult.ping} ms` : 'Tap to test in-RAM transfer'}
              </div>
            </div>
            <button 
              onClick={handleSpeedtest}
              disabled={testingSpeed}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {testingSpeed ? 'Testing...' : 'Start Test'}
            </button>
          </div>
        </div>

        {/* Widget 5: AirDrop Proximity Radar */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-neutral-200/80 shadow-sm flex flex-col justify-between sm:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi size={14} className="text-blue-500" /> AirDrop Local Radar ({radarDevices.length} Peers)
            </span>
            <span className="text-[10px] text-neutral-400">Continuous Discovery</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
            {radarDevices.map((dev) => (
              <div key={dev.id} className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-3 shrink-0 flex items-center gap-3 min-w-[170px]">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                  {dev.name[0]}
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-800 truncate max-w-[110px]">{dev.name}</div>
                  <div className="text-[10px] text-neutral-400">{dev.ip} • {dev.distance_m}m</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
