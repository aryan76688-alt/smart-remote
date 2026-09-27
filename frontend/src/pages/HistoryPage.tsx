import React, { useEffect, useState } from 'react';
import { History, Download, Trash2, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { ActivityItem } from '../types';
import { useApp } from '../context/AppContext';

export const HistoryPage: React.FC = () => {
  const { addNotification } = useApp();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await api.getActivities(100, filterType || undefined);
      setActivities(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [filterType]);

  const handleClear = async () => {
    try {
      await api.clearHistory();
      setActivities([]);
      addNotification('History Cleared', 'All activity records cleared.', 'info');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.exportHistory();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-remote-history-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      addNotification('Export Failed', err.message, 'error');
    }
  };

  const filtered = activities.filter(a =>
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.action_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-cyber-bg max-w-4xl mx-auto w-full select-none p-4 pb-20 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-cyber-border pb-3">
        <div>
          <h1 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-cyan-400" />
            <span>ACTIVITY &amp; AUDIT TRAIL</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">Non-sensitive operational audit log</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-cyan-300 rounded-xl text-xs flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center space-x-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex space-x-1 overflow-x-auto pb-1">
          {['', 'command', 'remote', 'screen', 'file', 'voice', 'system', 'sync'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono capitalize shrink-0 ${
                filterType === type ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              {type || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Log List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="text-center py-20 text-xs font-mono text-slate-500">Loading activities...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-xs font-mono text-slate-500">No activity records found.</div>
        ) : (
          filtered.map(act => (
            <div
              key={act.id}
              className="p-3 bg-cyber-surface border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
            >
              <div className="space-y-0.5 truncate pr-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 uppercase text-[10px] font-bold">
                    {act.action_type}
                  </span>
                  <span className="text-slate-200 font-sans font-medium truncate">{act.description}</span>
                </div>
                <div className="text-[10px] text-slate-500 pl-1">
                  {new Date(act.timestamp).toLocaleString()} • Result: {act.result}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
