import React, { useEffect, useState } from 'react';
import { Zap, Plus, CheckCircle2, Play, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { ShortcutItem } from '../../types';
import { useApp } from '../../context/AppContext';

export const ShortcutsTab: React.FC = () => {
  const { addNotification } = useApp();
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<{ name: string; output: string } | null>(null);

  useEffect(() => {
    api.getShortcuts().then(setShortcuts).catch(() => {});
  }, []);

  const handleRun = async (sc: ShortcutItem) => {
    if (!sc.command) return;
    setExecuting(sc.name);
    try {
      const res = await api.executeCommand(sc.command, true);
      setLastOutput({
        name: sc.name,
        output: res.exit_code === 0 ? res.stdout : `Error: ${res.stderr}`
      });
      addNotification(sc.name, res.exit_code === 0 ? 'Executed successfully' : 'Command returned error', res.exit_code === 0 ? 'success' : 'error');
    } catch (err: any) {
      addNotification(sc.name, err.message, 'error');
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 select-none overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
          <Zap className="w-4 h-4" />
          <span>SMART AUTOMATION ACTIONS</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shortcuts.map(sc => (
          <div
            key={sc.name}
            className="p-4 bg-cyber-surface border border-slate-800 hover:border-cyan-500/40 rounded-2xl space-y-2.5 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-100">{sc.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 font-mono">
                {sc.category}
              </span>
            </div>
            {sc.command && (
              <pre className="p-2 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-400 truncate">
                {sc.command}
              </pre>
            )}
            <button
              onClick={() => handleRun(sc)}
              disabled={executing === sc.name}
              className="w-full py-2 bg-gradient-to-r from-cyan-600/30 to-emerald-600/30 hover:from-cyan-600/50 hover:to-emerald-600/50 border border-cyan-500/40 text-cyan-200 font-medium rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{executing === sc.name ? 'Running...' : 'Trigger Action'}</span>
            </button>
          </div>
        ))}
      </div>

      {lastOutput && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-300 font-mono">
            <span>Result: {lastOutput.name}</span>
            <button onClick={() => setLastOutput(null)} className="text-slate-500 hover:text-slate-300">Close</button>
          </div>
          <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap p-2 bg-slate-900 rounded-lg">
            {lastOutput.output || '(No stdout)'}
          </pre>
        </div>
      )}
    </div>
  );
};
