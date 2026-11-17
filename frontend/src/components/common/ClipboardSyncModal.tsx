import React, { useState, useEffect } from 'react';
import { Clipboard, X, ArrowUpRight, ArrowDownLeft, Trash2, Check, RefreshCw, Zap } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface ClipboardSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClipboardSyncModal: React.FC<ClipboardSyncModalProps> = ({ isOpen, onClose }) => {
  const { triggerHaptic } = useApp();
  const [kaliClipboard, setKaliClipboard] = useState<string>('');
  const [phoneText, setPhoneText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchKaliClipboard = async () => {
    try {
      setLoading(true);
      const res = await api.getClipboard();
      if (res.success) {
        setKaliClipboard(res.text || '');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handlePushToKali = async (typeDirectly = false) => {
    if (!phoneText) return;
    try {
      setLoading(true);
      triggerHaptic(30);
      const res = await api.setClipboard(phoneText, typeDirectly);
      if (res.success) {
        setStatusMessage(typeDirectly ? 'Typed directly into active window!' : 'Pushed to Kali clipboard!');
        fetchKaliClipboard();
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handlePullFromKali = async () => {
    try {
      setLoading(true);
      triggerHaptic(30);
      const res = await api.getClipboard();
      if (res.success && res.text) {
        setKaliClipboard(res.text);
        setPhoneText(res.text);
        await navigator.clipboard.writeText(res.text);
        setStatusMessage('Copied from Kali into Phone clipboard!');
      } else {
        setStatusMessage('Kali clipboard is empty.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      triggerHaptic(20);
      await api.clearClipboard();
      setKaliClipboard('');
      setStatusMessage('Kali clipboard wiped.');
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKaliClipboard();
      // Try reading local phone clipboard if permission granted
      navigator.clipboard?.readText?.().then(txt => {
        if (txt) setPhoneText(txt);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl safe-bottom animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">CLIPBOARD BRIDGE</h2>
              <p className="text-[10px] text-slate-400 font-mono">Bi-Directional Phone &harr; Kali X11 Sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Phone Input Card */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>PHONE SCRATCHPAD / TEXT</span>
            <span>{phoneText.length} chars</span>
          </label>
          <textarea
            rows={3}
            value={phoneText}
            onChange={e => setPhoneText(e.target.value)}
            placeholder="Type or paste text from phone to push to Kali..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>

        {/* Sync Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePushToKali(false)}
            disabled={loading || !phoneText}
            className="py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <ArrowUpRight className="w-4 h-4 text-cyan-400" /> PUSH TO KALI
          </button>

          <button
            onClick={handlePullFromKali}
            disabled={loading}
            className="py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> PULL FROM KALI
          </button>
        </div>

        {/* Push & Type Directly */}
        <button
          onClick={() => handlePushToKali(true)}
          disabled={loading || !phoneText}
          className="w-full py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 active:scale-98 transition-all"
        >
          <Zap className="w-4 h-4 text-purple-400" /> PUSH & TYPE DIRECTLY INTO ACTIVE WINDOW
        </button>

        {/* Kali Clipboard Status */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>LIVE KALI X11 CLIPBOARD</span>
            <div className="flex items-center gap-2">
              <button onClick={fetchKaliClipboard} className="text-slate-400 hover:text-white" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleClear} className="text-rose-400 hover:text-rose-300" title="Wipe Kali Clipboard">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 max-h-20 overflow-y-auto break-all select-all">
            {kaliClipboard || <span className="text-slate-600 italic">Empty</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
