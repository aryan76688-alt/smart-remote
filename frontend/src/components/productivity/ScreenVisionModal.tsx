import React, { useState } from 'react';
import {
  Sparkles, X, Terminal, Copy, Check, Play, AlertCircle,
  HelpCircle, RefreshCw, Cpu, CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface ScreenVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (cmd: string) => void;
}

export const ScreenVisionModal: React.FC<ScreenVisionModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand
}) => {
  const { triggerHaptic } = useApp();
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [executedCmd, setExecutedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    triggerHaptic(50);
    setLoading(true);
    setError(null);
    try {
      const res = await api.getScreenVision(prompt.trim() || undefined);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Screen Vision analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (cmd: string) => {
    triggerHaptic(20);
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleRun = async (cmd: string) => {
    triggerHaptic(60);
    setExecutedCmd(cmd);
    try {
      if (onExecuteCommand) {
        onExecuteCommand(cmd);
      } else {
        await api.executeCommand(cmd, true);
      }
    } catch (err: any) {
      alert(`Command execution failed: ${err.message}`);
    } finally {
      setTimeout(() => setExecutedCmd(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md font-sans">
      <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-cyan-500/30 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                GEMINI AI SCREEN VISION
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                  CO-PILOT
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Multimodal Desktop & Terminal Inspector</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Custom Prompt Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Ask AI about current screen state:</span>
              <span className="text-cyan-400">Optional</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Explain this terminal error, What code is open?..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAnalyze(); }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{loading ? 'Analyzing...' : 'Scan Screen'}</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Analysis Result */}
          {result && (
            <div className="space-y-3 pt-1">
              {/* Summary */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-1">
                <div className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Executive Summary</span>
                </div>
                <p className="text-xs text-slate-100 font-medium leading-relaxed">
                  {result.summary}
                </p>
              </div>

              {/* Detailed Explanation */}
              {result.explanation && (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                    Detailed AI Vision Breakdown
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {result.explanation}
                  </p>
                </div>
              )}

              {/* Suggested Terminal Commands */}
              {result.terminal_commands && result.terminal_commands.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Recommended Terminal Commands</span>
                  </div>

                  <div className="space-y-2">
                    {result.terminal_commands.map((cmd: string, idx: number) => {
                      const isCopied = copiedCmd === cmd;
                      const isRun = executedCmd === cmd;

                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 shadow-sm font-mono text-xs"
                        >
                          <span className="text-cyan-300 truncate flex-1 font-mono text-[11px] selection:bg-cyan-500">
                            {cmd}
                          </span>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => handleCopy(cmd)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="Copy command"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => handleRun(cmd)}
                              disabled={isRun}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center space-x-1 active:scale-95 transition-all shadow-sm"
                              title="Execute directly on Kali Linux"
                            >
                              {isRun ? <CheckCircle2 className="w-3 h-3 text-slate-950" /> : <Play className="w-3 h-3 text-slate-950" />}
                              <span>{isRun ? 'Sent!' : 'Run'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
