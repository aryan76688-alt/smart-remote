import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { ProcessItem } from '../../types';
import { useApp } from '../../context/AppContext';

export const ProcessManager: React.FC = () => {
  const { addNotification } = useApp();
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<'cpu' | 'memory'>('cpu');
  const [killTarget, setKillTarget] = useState<ProcessItem | null>(null);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const data = await api.getProcesses(50, sortKey);
      setProcesses(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    const timer = setInterval(fetchProcesses, 4000);
    return () => clearInterval(timer);
  }, [sortKey]);

  const handleKill = async (signal = 15) => {
    if (!killTarget) return;
    try {
      await api.killProcess(killTarget.pid, signal);
      addNotification('Process Terminated', `Sent signal ${signal} to ${killTarget.name} (PID ${killTarget.pid})`, 'info');
      setKillTarget(null);
      fetchProcesses();
    } catch (err: any) {
      addNotification('Kill Failed', err.message, 'error');
    }
  };

  const filtered = processes.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.pid.toString().includes(search) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-cyber-surface border border-slate-800 rounded-2xl p-4 space-y-3 select-none">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Running Processes ({processes.length})
          </h3>
          <button
            onClick={fetchProcesses}
            className="p-1 text-slate-400 hover:text-cyan-400"
            title="Refresh process list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-40">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PID / name..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setSortKey(sortKey === 'cpu' ? 'memory' : 'cpu')}
            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300"
          >
            Sort: {sortKey.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Process Table */}
      <div className="overflow-x-auto max-h-80 border border-slate-900 rounded-xl">
        <table className="w-full text-left text-xs text-slate-300 font-mono">
          <thead className="bg-slate-950/80 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0">
            <tr>
              <th className="p-2.5">PID</th>
              <th className="p-2.5">Command</th>
              <th className="p-2.5">User</th>
              <th className="p-2.5">CPU%</th>
              <th className="p-2.5">MEM%</th>
              <th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {filtered.slice(0, 30).map(p => (
              <tr key={p.pid} className="hover:bg-slate-800/40 transition-colors">
                <td className="p-2.5 text-cyan-400">{p.pid}</td>
                <td className="p-2.5 truncate max-w-[150px] font-semibold text-slate-200">{p.name}</td>
                <td className="p-2.5 text-slate-400">{p.username}</td>
                <td className="p-2.5">
                  <span className={p.cpu_percent > 50 ? 'text-rose-400 font-bold' : p.cpu_percent > 20 ? 'text-amber-400' : 'text-slate-300'}>
                    {p.cpu_percent}%
                  </span>
                </td>
                <td className="p-2.5">{p.memory_percent}%</td>
                <td className="p-2.5 text-right">
                  <button
                    onClick={() => setKillTarget(p)}
                    className="p-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[10px] px-2"
                  >
                    Kill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kill Process Modal */}
      {killTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-rose-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-semibold text-sm">Terminate Process</h4>
            </div>
            <p className="text-xs text-slate-300">
              Terminate <strong>{killTarget.name}</strong> (PID: <span className="font-mono text-cyan-300">{killTarget.pid}</span>)?
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => handleKill(15)}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-xl text-xs"
              >
                SIGTERM (15)
              </button>
              <button
                onClick={() => handleKill(9)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs"
              >
                SIGKILL (9)
              </button>
              <button
                onClick={() => setKillTarget(null)}
                className="py-2 px-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
