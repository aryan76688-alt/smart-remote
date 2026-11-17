import React, { useState, useEffect } from 'react';
import { Monitor, Layers, EyeOff, Check, RefreshCw, Zap, Shield } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const WorkspaceSwitcherTab: React.FC = () => {
  const { triggerHaptic } = useApp();
  const [currentWorkspace, setCurrentWorkspace] = useState<number>(0);
  const [totalWorkspaces, setTotalWorkspaces] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(false);
  const [switching, setSwitching] = useState<number | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.getWorkspaces();
      setCurrentWorkspace(res.current);
      setTotalWorkspaces(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleSwitch = async (index: number) => {
    triggerHaptic(40);
    setSwitching(index);
    try {
      await api.switchWorkspace(index);
      setCurrentWorkspace(index);
    } catch (err: any) {
      alert(err.message || 'Failed to switch workspace');
    } finally {
      setSwitching(null);
    }
  };

  const workspaces = [
    { id: 0, name: 'Desktop 1', label: 'Primary Workspace', desc: 'Main browsing & active apps', color: 'cyan' },
    { id: 1, name: 'Desktop 2', label: 'Stealth / Private Space', desc: 'Hidden workspace for confidential work', color: 'emerald' },
    { id: 2, name: 'Desktop 3', label: 'Terminal & Dev', desc: 'VS Code, Git, and Shell sessions', color: 'purple' },
    { id: 3, name: 'Desktop 4', label: 'Media & Monitoring', desc: 'Dashboards, CCTV, and music players', color: 'amber' }
  ];

  return (
    <div className="h-full flex flex-col justify-between p-3 select-none text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-purple-500/30 p-3 rounded-2xl shadow-lg mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              VIRTUAL DESKTOPS
              <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono">
                X11 SPACES
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">Active Workspace: Desktop {currentWorkspace + 1}</p>
          </div>
        </div>

        <button
          onClick={fetchWorkspaces}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
        </button>
      </div>

      {/* Instant Stealth Switch Quick Action */}
      <div className="mb-3">
        <button
          onClick={() => handleSwitch(1)}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-emerald-300 flex items-center justify-between text-xs font-bold font-mono active:scale-95 transition-all shadow-md"
        >
          <div className="flex items-center space-x-2">
            <EyeOff className="w-4 h-4 text-emerald-400" />
            <span>INSTANT STEALTH: FLIP TO DESKTOP 2</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
            PANIC HIDE
          </span>
        </button>
      </div>

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-2 gap-2.5 flex-1 overflow-y-auto">
        {workspaces.map((ws) => {
          const isActive = currentWorkspace === ws.id;
          const isPending = switching === ws.id;

          return (
            <button
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              disabled={isPending}
              className={`relative p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 shadow-md ${
                isActive
                  ? 'bg-gradient-to-br from-purple-900/40 via-slate-900 to-black border-purple-500 text-white shadow-purple-500/20'
                  : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-xs font-mono font-bold text-purple-300">
                  {ws.name}
                </span>
                {isActive && (
                  <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <Check className="w-3 h-3" />
                    <span>ACTIVE</span>
                  </span>
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-slate-100">{ws.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{ws.desc}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Switch to Space</span>
                <span className="text-purple-400 font-bold">wmctrl -s {ws.id}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
