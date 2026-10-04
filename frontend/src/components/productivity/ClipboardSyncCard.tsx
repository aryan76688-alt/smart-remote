import React, { useState, useEffect } from 'react';
import { Clipboard, ArrowDown, ArrowUp, RefreshCw, Check, Copy } from 'lucide-react';
import { api } from '../../services/api';

export const ClipboardSyncCard: React.FC = () => {
  const [laptopClipboard, setLaptopClipboard] = useState<string>('');
  const [mobileText, setMobileText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [pushed, setPushed] = useState<boolean>(false);

  const fetchLaptopClipboard = async () => {
    setLoading(true);
    try {
      const res = await api.getClipboard();
      if (res.success) {
        setLaptopClipboard(res.text);
      }
    } catch (e) {
      console.error('Failed to read laptop clipboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaptopClipboard();
  }, []);

  const handleCopyFromLaptop = async () => {
    if (!laptopClipboard) return;
    try {
      await navigator.clipboard.writeText(laptopClipboard);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Could not copy to phone clipboard:', e);
    }
  };

  const handlePushToLaptop = async () => {
    if (!mobileText.trim()) return;
    setLoading(true);
    try {
      const res = await api.setClipboard(mobileText);
      if (res.success) {
        setPushed(true);
        setLaptopClipboard(mobileText);
        setMobileText('');
        setTimeout(() => setPushed(false), 2000);
      }
    } catch (e) {
      console.error('Failed to push to laptop clipboard:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Clipboard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Universal Clipboard Sync</h3>
            <p className="text-xs text-slate-400">Live clipboard copy-paste between phone and laptop</p>
          </div>
        </div>
        <button
          onClick={fetchLaptopClipboard}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Laptop Clipboard View */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Active on Kali Laptop:</span>
          {laptopClipboard && (
            <button
              onClick={handleCopyFromLaptop}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Phone!' : 'Copy to Phone'}
            </button>
          )}
        </div>
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-xs text-slate-300 font-mono max-h-24 overflow-y-auto break-all select-all">
          {laptopClipboard ? laptopClipboard : <span className="text-slate-600 italic">Laptop clipboard is empty</span>}
        </div>
      </div>

      {/* Send to Laptop Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={mobileText}
          onChange={(e) => setMobileText(e.target.value)}
          placeholder="Paste or type text to send to laptop..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          onKeyDown={(e) => e.key === 'Enter' && handlePushToLaptop()}
        />
        <button
          onClick={handlePushToLaptop}
          disabled={loading || !mobileText.trim()}
          className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs px-3 py-2 rounded-lg transition"
        >
          {pushed ? <Check className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
          {pushed ? 'Sent!' : 'Send'}
        </button>
      </div>
    </div>
  );
};
