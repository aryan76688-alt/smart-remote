import React, { useState, useEffect } from 'react';
import {
  Boxes, Server, GitBranch, Trash2, RefreshCw, Play, Square, RotateCw,
  FileText, CheckCircle2, XCircle, AlertTriangle, Clock, HardDrive, Terminal
} from 'lucide-react';
import { api } from '../services/api';

export const DevOpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'containers' | 'services' | 'git' | 'cleaner'>('containers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Containers
  const [containerData, setContainerData] = useState<{ runtime: string; containers: any[] }>({ runtime: 'none', containers: [] });
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; logs: string } | null>(null);

  // Services
  const [services, setServices] = useState<any[]>([]);

  // Git
  const [gitStatus, setGitStatus] = useState<any>(null);

  // Cleaner
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<any>(null);

  // ── Load Containers ──
  const fetchContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getContainers();
      setContainerData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load containers');
    } finally {
      setLoading(false);
    }
  };

  const handleContainerAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    try {
      setLoading(true);
      await api.containerAction(id, action);
      await fetchContainers();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} container`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (id: string) => {
    try {
      setLoading(true);
      const res = await api.getContainerLogs(id, 100);
      setSelectedLogs(res);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  // ── Load Services ──
  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getServices();
      if (res.success) {
        setServices(res.services || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceAction = async (service: string, action: 'start' | 'stop' | 'restart', is_user: boolean) => {
    try {
      setLoading(true);
      await api.serviceAction(service, action, is_user);
      await fetchServices();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} ${service}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Load Git ──
  const fetchGit = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGitStatus();
      setGitStatus(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load git status');
    } finally {
      setLoading(false);
    }
  };

  // ── Run Cleaner ──
  const handleClean = async (target: 'all' | 'apt' | 'journal' | 'containers') => {
    try {
      setCleaning(true);
      const res = await api.cleanSystem(target);
      setCleanResult(res.details);
    } catch (err: any) {
      alert(err.message || 'Clean failed');
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'containers') fetchContainers();
    else if (activeTab === 'services') fetchServices();
    else if (activeTab === 'git') fetchGit();
  }, [activeTab]);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 pb-24">
      {/* Deck Header */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-cyan-500/30 p-4 rounded-2xl shadow-lg backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              DEVOPS & SYSADMIN DECK
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/40 px-2 py-0.5 rounded-full font-mono">
                OPS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Containers • Systemd • Git Hub • Maintenance</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'containers') fetchContainers();
            else if (activeTab === 'services') fetchServices();
            else if (activeTab === 'git') fetchGit();
          }}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
        {[
          { id: 'containers', label: 'CONTAINERS', icon: Boxes },
          { id: 'services', label: 'SERVICES', icon: Server },
          { id: 'git', label: 'GIT', icon: GitBranch },
          { id: 'cleaner', label: 'CLEANER', icon: Trash2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold tracking-wider transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ── TAB 1: CONTAINERS ── */}
      {activeTab === 'containers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Runtime: <span className="text-cyan-400 font-bold uppercase">{containerData.runtime}</span></span>
            <span>{containerData.containers.length} Containers</span>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {containerData.containers.map((c, idx) => {
              const isRunning = c.status?.toLowerCase().includes('up');
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-slate-100 font-bold text-sm truncate">{c.names || c.id}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      isRunning ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate">
                    Image: <span className="text-slate-300">{c.image}</span>
                    {c.ports && <span> • Ports: <span className="text-cyan-400">{c.ports}</span></span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                    {isRunning ? (
                      <button
                        onClick={() => handleContainerAction(c.id, 'stop')}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1 active:scale-95"
                      >
                        <Square className="w-3 h-3" /> Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => handleContainerAction(c.id, 'start')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-1 active:scale-95"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}

                    <button
                      onClick={() => handleContainerAction(c.id, 'restart')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1 active:scale-95"
                    >
                      <RotateCw className="w-3 h-3" /> Restart
                    </button>

                    <button
                      onClick={() => handleViewLogs(c.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1 ml-auto active:scale-95"
                    >
                      <FileText className="w-3 h-3" /> Logs
                    </button>
                  </div>
                </div>
              );
            })}

            {containerData.containers.length === 0 && !loading && (
              <div className="text-center py-10 text-slate-500 text-xs">
                No containers found or container runtime not active.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Container Logs Modal */}
      {selectedLogs && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-slate-200">Container Logs ({selectedLogs.id})</span>
              <button
                onClick={() => setSelectedLogs(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded"
              >
                Close
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-slate-950 p-3 rounded-xl mt-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
              {selectedLogs.logs || 'No logs found.'}
            </pre>
          </div>
        </div>
      )}

      {/* ── TAB 2: SYSTEMD SERVICES ── */}
      {activeTab === 'services' && (
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${svc.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-slate-100 font-bold truncate">{svc.label}</span>
                  {svc.is_user && (
                    <span className="text-[9px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400">user</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{svc.service}</div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {svc.active ? (
                  <button
                    onClick={() => handleServiceAction(svc.service, 'stop', svc.is_user)}
                    className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300"
                    title="Stop Service"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleServiceAction(svc.service, 'start', svc.is_user)}
                    className="p-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300"
                    title="Start Service"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleServiceAction(svc.service, 'restart', svc.is_user)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                  title="Restart Service"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 3: GIT DASHBOARD ── */}
      {activeTab === 'git' && gitStatus && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-100">{gitStatus.branch || 'unknown'}</span>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                  {gitStatus.modified} Modified
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                  {gitStatus.untracked} Untracked
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Recent Commits
            </div>
            {gitStatus.commits?.map((cmt: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 font-mono text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-400 font-bold">{cmt.hash}</span>
                  <span className="text-slate-500">{cmt.date}</span>
                </div>
                <div className="text-slate-200 font-medium">{cmt.message}</div>
                <div className="text-[10px] text-slate-400">By {cmt.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: SYSTEM CLEANER ── */}
      {activeTab === 'cleaner' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <HardDrive className="w-5 h-5" />
              <span>Safe Storage Optimization & Cache Cleaner</span>
            </div>
            <p className="text-xs text-slate-400">
              Prunes temporary APT package archives, clears systemd journals older than 3 days, and safely vacuums dangling container layers.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => handleClean('all')}
                disabled={cleaning}
                className="p-3 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <Trash2 className={`w-4 h-4 ${cleaning ? 'animate-spin' : ''}`} />
                1-TAP FULL CLEAN
              </button>

              <button
                onClick={() => handleClean('journal')}
                disabled={cleaning}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                VACUUM JOURNALS
              </button>
            </div>

            {cleanResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mt-3 text-xs font-mono space-y-1">
                <div className="text-emerald-400 font-bold">✓ Cleaning Complete</div>
                {Object.entries(cleanResult).map(([k, v]: any) => (
                  <div key={k} className="text-slate-300">
                    <span className="text-slate-500">{k}:</span> {v}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
