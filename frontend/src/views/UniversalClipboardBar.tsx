import React, { useState, useEffect } from 'react';
import {
  Clipboard,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  X,
  Laptop,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface UniversalClipboardBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalClipboardBar: React.FC<UniversalClipboardBarProps> = ({ isOpen, onClose }) => {
  const { triggerHaptic, addNotification } = useApp();

  const [clipboardText, setClipboardText] = useState<string>('');
  const [lastSource, setLastSource] = useState<string>('pearOS');
  const [inputText, setInputText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchClipboard = async () => {
    try {
      const res = await api.getUniversalClipboard();
      if (res && res.text !== undefined) {
        setClipboardText(res.text);
        if (res.source) setLastSource(res.source);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchClipboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLocally = () => {
    if (!clipboardText) return;
    navigator.clipboard.writeText(clipboardText);
    setCopied(true);
    triggerHaptic(30);
    setTimeout(() => setCopied(false), 2000);
    addNotification('Clipboard', 'Copied to device clipboard', 'success');
  };

  const handlePushToPearOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    triggerHaptic(40);
    try {
      await api.setUniversalClipboard(inputText.trim());
      setClipboardText(inputText.trim());
      setLastSource('Mobile');
      setInputText('');
      addNotification('Universal Clipboard', 'Text sent to pearOS clipboard', 'success');
    } catch (err: any) {
      addNotification('Clipboard Error', err.message || 'Push failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2100] flex items-start justify-center p-4 pt-12 bg-black/20 backdrop-blur-xs select-none animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white/90 backdrop-blur-3xl border border-black/10 shadow-2xl rounded-3xl p-5 space-y-4 animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Clipboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">Universal Clipboard</h2>
              <p className="text-[10px] text-slate-500">Instant bi-directional copy/paste between devices</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchClipboard}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Current Active Clipboard Card */}
        <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1">
              {lastSource === 'pearOS' ? <Laptop className="w-3.5 h-3.5 text-blue-600" /> : <Smartphone className="w-3.5 h-3.5 text-emerald-600" />}
              <span>Last source: {lastSource}</span>
            </span>
            <button
              onClick={handleCopyLocally}
              disabled={!clipboardText}
              className="flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline disabled:opacity-40"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="max-h-28 overflow-y-auto font-mono text-xs text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 select-text">
            {clipboardText || <span className="text-slate-400 italic font-sans text-xs">Clipboard is currently empty</span>}
          </div>
        </div>

        {/* Push to pearOS Form */}
        <form onSubmit={handlePushToPearOS} className="space-y-2">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider pl-1">
            Push text to pearOS Clipboard
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type text to send to pearOS..."
              className="flex-1 bg-slate-100 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:bg-white focus:border-blue-500 shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-40"
            >
              Push
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
