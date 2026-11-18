import React, { useState, useEffect } from 'react';
import { Volume2, Sun, XCircle, Play, Pause } from 'lucide-react';
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
    <div className="w-full h-full px-4 pb-24 pt-1 overflow-y-auto">
      <div className="max-w-[980px] mx-auto flex flex-col gap-4">
        {/* 3 Minimalist Hardware Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="apple-glass-card p-5 flex flex-col">
            <span className="type-fine text-apple-ink48">CPU</span>
            <span className="type-display-lg font-mono text-apple-ink mt-1">{telemetry.cpu_usage}%</span>
          </div>
          <div className="apple-glass-card p-5 flex flex-col">
            <span className="type-fine text-apple-ink48">Memory</span>
            <span className="type-display-lg font-mono text-apple-ink mt-1">{telemetry.ram_usage}%</span>
          </div>
          <div className="apple-glass-card p-5 flex flex-col">
            <span className="type-fine text-apple-ink48">Thermals</span>
            <span className="type-display-lg font-mono text-apple-ink mt-1">{telemetry.temperature_c}°C</span>
          </div>
        </div>

        {/* Display & Audio Controls */}
        <div className="apple-glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Volume2 size={18} className="text-apple-primary shrink-0" />
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
              className="flex-1 accent-[#0066cc]"
            />
            <span className="type-caption font-mono text-apple-ink w-10 text-right">{volume}%</span>
          </div>
          <div className="flex items-center gap-3">
            <Sun size={18} className="text-apple-primary shrink-0" />
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
              className="flex-1 accent-[#0066cc]"
            />
            <span className="type-caption font-mono text-apple-ink w-10 text-right">{brightness}%</span>
          </div>
        </div>

        {/* SpeedTest Card */}
        <div className="apple-glass-card p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="type-body-strong text-apple-ink">In-RAM SpeedTest</h3>
            <p className="type-caption text-apple-ink48 font-mono mt-0.5">
              {speedtestData
                ? `${speedtestData.download_mbps} Mbps · Ping ${speedtestData.ping_ms} ms`
                : 'Benchmark local bus & network throughput'}
            </p>
          </div>
          <button
            type="button"
            disabled={speedtesting}
            onClick={handleRunSpeedtest}
            className="apple-btn-primary px-5 py-2.5 type-caption min-h-[44px]"
          >
            {speedtesting ? 'Testing...' : 'Run Test'}
          </button>
        </div>

        {/* Process Hunter */}
        <div className="apple-glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-apple-divider pb-3">
            <h3 className="type-body-strong text-apple-ink">Active Processes</h3>
            <span className="type-fine font-mono text-apple-ink48">STOP · CONT · KILL</span>
          </div>
          <div className="flex flex-col divide-y divide-apple-divider max-h-56 overflow-y-auto">
            {processes.slice(0, 8).map((p) => (
              <div key={p.pid} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="type-fine font-mono text-apple-ink48">#{p.pid}</span>
                  <span className="type-caption-strong text-apple-ink truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="type-fine font-mono font-semibold text-apple-primary mr-1">{p.cpu}%</span>
                  <button
                    type="button"
                    aria-label={`Freeze ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'STOP'); refreshTelemetry(); }}
                    className="apple-btn-pearl w-8 h-8 flex items-center justify-center"
                  >
                    <Pause size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Resume ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'CONT'); refreshTelemetry(); }}
                    className="apple-btn-pearl w-8 h-8 flex items-center justify-center"
                  >
                    <Play size={13} className="text-apple-primary" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Kill ${p.name}`}
                    onClick={async () => { await api.sendProcessSignal(p.pid, 'KILL'); refreshTelemetry(); }}
                    className="apple-btn-pearl w-8 h-8 flex items-center justify-center"
                  >
                    <XCircle size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clipboard History */}
        <div className="apple-glass-card p-5 flex flex-col gap-2">
          <h3 className="type-body-strong text-apple-ink border-b border-apple-divider pb-3">Universal Clipboard</h3>
          <div className="flex flex-col divide-y divide-apple-divider">
            {clipboardHistory.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => api.typeText(clip.text)}
                className="py-3 flex items-center justify-between text-left active:scale-[0.99] transition-transform"
              >
                <span className="type-caption font-mono text-apple-ink truncate max-w-[260px]">{clip.text}</span>
                <span className="type-fine text-apple-primary shrink-0 ml-2">Paste</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
