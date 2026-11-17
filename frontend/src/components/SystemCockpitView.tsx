import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Thermometer, Volume2, Sun, Clipboard, Activity, Zap, RefreshCw, XCircle, Play, Pause } from 'lucide-react';
import { api } from '../services/api';

export const SystemCockpitView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<any>({
    cpu_usage: 12.0,
    ram_usage: 38.0,
    ram_used_mb: 4096,
    ram_total_mb: 8192,
    temperature_c: 44.0,
    battery_percent: 100,
    power_plugged: true
  });

  const [processes, setProcesses] = useState<any[]>([]);
  const [clipboardHistory, setClipboardHistory] = useState<any[]>([]);
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(80);
  const [speedtestData, setSpeedtestData] = useState<any>(null);
  const [speedtesting, setSpeedtesting] = useState(false);

  const refreshTelemetry = async () => {
    try {
      const data = await api.getTelemetry();
      if (data.success) setTelemetry(data);

      const procData = await api.getProcesses();
      if (procData.success) setProcesses(procData.processes);

      const clipData = await api.getClipboardHistory();
      if (clipData.success) setClipboardHistory(clipData.history);
    } catch (e) {
      // fallback
    }
  };

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    await api.setVolume(val);
  };

  const handleBrightnessChange = async (val: number) => {
    setBrightness(val);
    await api.setBrightness(val);
  };

  const handleRunSpeedtest = async () => {
    setSpeedtesting(true);
    try {
      const res = await api.runSpeedtest();
      if (res.success) setSpeedtestData(res);
    } finally {
      setSpeedtesting(false);
    }
  };

  const handleProcessSignal = async (pid: number, sig: 'STOP' | 'CONT' | 'KILL') => {
    await api.sendProcessSignal(pid, sig);
    refreshTelemetry();
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* 3 Core Hardware Gauges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center">
          <Cpu size={20} className="text-apple-blue mb-1" />
          <span className="text-[10px] text-slate-500 uppercase font-bold">CPU Load</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1">{telemetry.cpu_usage}%</span>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center">
          <HardDrive size={20} className="text-apple-purple mb-1" />
          <span className="text-[10px] text-slate-500 uppercase font-bold">RAM In-Use</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1">{telemetry.ram_usage}%</span>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center">
          <Thermometer size={20} className="text-apple-orange mb-1" />
          <span className="text-[10px] text-slate-500 uppercase font-bold">Thermals</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1">{telemetry.temperature_c}°C</span>
        </div>
      </div>

      {/* Sliders for Volume & Brightness */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Volume2 size={18} className="text-slate-600" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 accent-apple-blue"
          />
          <span className="text-xs font-mono font-bold w-9 text-right text-slate-700">{volume}%</span>
        </div>

        <div className="flex items-center gap-3">
          <Sun size={18} className="text-slate-600" />
          <input
            type="range"
            min="10"
            max="100"
            value={brightness}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            className="flex-1 accent-apple-orange"
          />
          <span className="text-xs font-mono font-bold w-9 text-right text-slate-700">{brightness}%</span>
        </div>
      </div>

      {/* SpeedTest In-RAM Benchmark */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Zap size={14} className="text-apple-yellow" />
            <span>In-Memory Network Stresser</span>
          </h4>
          {speedtestData ? (
            <span className="text-[11px] font-mono text-apple-green block mt-0.5">
              {speedtestData.download_mbps} Mbps • Ping: {speedtestData.ping_ms}ms
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">Benchmark local bus & TCP throughput</span>
          )}
        </div>
        <button
          onClick={handleRunSpeedtest}
          disabled={speedtesting}
          className="px-3 py-1.5 bg-apple-blue text-white rounded-xl text-xs font-semibold active:scale-95 transition-all shadow-sm"
        >
          {speedtesting ? 'Testing...' : 'Test Speed'}
        </button>
      </div>

      {/* Process Zombie Hunter */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Activity size={14} className="text-apple-red" />
            <span>Process Hunter (Top CPU)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">SIGSTOP / SIGCONT / SIGKILL</span>
        </div>
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {processes.slice(0, 6).map((p) => (
            <div key={p.pid} className="flex items-center justify-between py-1 px-2 rounded-xl bg-white/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400">#{p.pid}</span>
                <span className="font-semibold text-slate-800 truncate max-w-[120px]">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-apple-blue">{p.cpu}%</span>
                <button
                  onClick={() => handleProcessSignal(p.pid, 'STOP')}
                  className="p-1 text-apple-orange hover:bg-slate-100 rounded"
                  title="Freeze (SIGSTOP)"
                >
                  <Pause size={12} />
                </button>
                <button
                  onClick={() => handleProcessSignal(p.pid, 'CONT')}
                  className="p-1 text-apple-green hover:bg-slate-100 rounded"
                  title="Resume (SIGCONT)"
                >
                  <Play size={12} />
                </button>
                <button
                  onClick={() => handleProcessSignal(p.pid, 'KILL')}
                  className="p-1 text-apple-red hover:bg-slate-100 rounded"
                  title="Terminate (SIGKILL)"
                >
                  <XCircle size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Universal Clipboard History */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
          <Clipboard size={14} className="text-apple-purple" />
          <span>In-Memory Clipboard History (RAM-Only)</span>
        </h4>
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
          {clipboardHistory.map((clip) => (
            <div
              key={clip.id}
              onClick={() => {
                api.typeText(clip.text);
                alert("Pasted to active pearOS window");
              }}
              className="flex items-center justify-between p-2 rounded-xl bg-white/60 hover:bg-white text-xs cursor-pointer active:scale-98 transition-all"
            >
              <span className="truncate max-w-[240px] font-mono text-slate-700">{clip.text}</span>
              <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">{clip.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
