import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Thermometer, Volume2, Sun, Clipboard, Activity, Zap, XCircle, Play, Pause } from 'lucide-react';
import { api } from '../services/api';

export const SystemCockpitView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<any>({
    cpu_usage: 12.0,
    ram_usage: 38.0,
    temperature_c: 44.0
  });
  const [processes, setProcesses] = useState<any[]>([]);
  const [clipboardHistory, setClipboardHistory] = useState<any[]>([]);
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(80);
  const [speedtestData, setSpeedtestData] = useState<any>(null);
  const [speedtesting, setSpeedtesting] = useState(false);

  const refreshTelemetry = async () => {
    try {
      const [t, p, c] = await Promise.all([
        api.getTelemetry(),
        api.getProcesses(),
        api.getClipboardHistory()
      ]);
      if (t.success) setTelemetry(t);
      if (p.success) setProcesses(p.processes);
      if (c.success) setClipboardHistory(c.history);
    } catch (_e) {}
  };

  useEffect(() => {
    refreshTelemetry();
    const timer = setInterval(refreshTelemetry, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleRunSpeedtest = async () => {
    setSpeedtesting(true);
    try {
      const res = await api.runSpeedtest();
      if (res.success) setSpeedtestData(res);
    } finally {
      setSpeedtesting(false);
    }
  };

  return (
    <div className="w-full h-full px-3 pb-6 overflow-y-auto flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-3">
        {/* 3 Luminous Hardware Gauges */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="liquid-glass rounded-2xl p-3 flex flex-col items-center">
            <Cpu size={18} className="text-stitch-primary mb-1" />
            <span className="font-mono text-[9px] uppercase text-stitch-outline">CPU</span>
            <span className="font-mono text-lg font-bold text-stitch-text">{telemetry.cpu_usage}%</span>
          </div>
          <div className="liquid-glass rounded-2xl p-3 flex flex-col items-center">
            <HardDrive size={18} className="text-stitch-tertiary mb-1" />
            <span className="font-mono text-[9px] uppercase text-stitch-outline">RAM</span>
            <span className="font-mono text-lg font-bold text-stitch-text">{telemetry.ram_usage}%</span>
          </div>
          <div className="liquid-glass rounded-2xl p-3 flex flex-col items-center">
            <Thermometer size={18} className="text-amber-300 mb-1" />
            <span className="font-mono text-[9px] uppercase text-stitch-outline">TEMP</span>
            <span className="font-mono text-lg font-bold text-stitch-text">{telemetry.temperature_c}°C</span>
          </div>
        </div>

        {/* Sliders */}
        <div className="liquid-glass rounded-2xl p-3.5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Volume2 size={17} className="text-stitch-primary" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                api.setVolume(v);
              }}
              className="flex-1 accent-[#3e90ff]"
            />
            <span className="font-mono text-xs text-stitch-text w-9 text-right">{volume}%</span>
          </div>
          <div className="flex items-center gap-3">
            <Sun size={17} className="text-amber-300" />
            <input
              type="range"
              min="10"
              max="100"
              value={brightness}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBrightness(v);
                api.setBrightness(v);
              }}
              className="flex-1 accent-[#fbbf24]"
            />
            <span className="font-mono text-xs text-stitch-text w-9 text-right">{brightness}%</span>
          </div>
        </div>

        {/* SpeedTest */}
        <div className="liquid-glass rounded-2xl p-3.5 flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-xs font-bold text-stitch-text flex items-center gap-1.5">
              <Zap size={14} className="text-stitch-secondary" />
              <span>In-RAM SpeedTest</span>
            </h4>
            <span className="font-mono text-[10px] text-stitch-muted">
              {speedtestData
                ? `${speedtestData.download_mbps} Mbps • Ping ${speedtestData.ping_ms}ms`
                : 'Measure TCP & local bus throughput'}
            </span>
          </div>
          <button
            type="button"
            disabled={speedtesting}
            onClick={handleRunSpeedtest}
            className="px-3.5 py-2 rounded-xl bg-stitch-primaryStrong/80 text-white text-xs font-semibold shadow-[0_0_15px_rgba(62,144,255,0.4)] active:scale-95"
          >
            {speedtesting ? 'Testing...' : 'Run'}
          </button>
        </div>

        {/* Process Hunter */}
        <div className="liquid-glass rounded-2xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <h4 className="font-display text-xs font-bold text-stitch-text flex items-center gap-1.5">
              <Activity size={14} className="text-stitch-error" />
              <span>Process Hunter</span>
            </h4>
            <span className="font-mono text-[9px] text-stitch-outline">STOP / CONT / KILL</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
            {processes.slice(0, 7).map((p) => (
              <div key={p.pid} className="liquid-glass-deep rounded-xl px-2.5 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-stitch-outline">#{p.pid}</span>
                  <span className="font-medium text-stitch-text truncate max-w-[125px]">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[11px] font-bold text-stitch-primary">{p.cpu}%</span>
                  <button
                    type="button"
                    aria-label={`Freeze ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'STOP'); refreshTelemetry(); }}
                    className="w-7 h-7 rounded-lg liquid-btn flex items-center justify-center text-amber-300"
                  >
                    <Pause size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Resume ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'CONT'); refreshTelemetry(); }}
                    className="w-7 h-7 rounded-lg liquid-btn flex items-center justify-center text-stitch-secondary"
                  >
                    <Play size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Kill ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'KILL'); refreshTelemetry(); }}
                    className="w-7 h-7 rounded-lg liquid-btn flex items-center justify-center text-stitch-error"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clipboard History */}
        <div className="liquid-glass rounded-2xl p-3.5 flex flex-col gap-2">
          <h4 className="font-display text-xs font-bold text-stitch-text flex items-center gap-1.5 pb-1 border-b border-white/10">
            <Clipboard size={14} className="text-stitch-tertiary" />
            <span>Universal Clipboard Stack</span>
          </h4>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {clipboardHistory.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => api.typeText(clip.text)}
                className="liquid-glass-deep rounded-xl p-2.5 flex items-center justify-between text-left hover:bg-white/10 active:scale-[0.99] transition-all"
              >
                <span className="font-mono text-xs text-stitch-text truncate max-w-[230px]">{clip.text}</span>
                <span className="font-mono text-[10px] text-stitch-outline shrink-0 ml-2">{clip.time}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
