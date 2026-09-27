import React, { useState, useEffect } from 'react';
import {
  Globe, Radio, Play, Square, RefreshCw, Copy, Check,
  ExternalLink, Smartphone, AlertTriangle, ShieldCheck, Terminal
} from 'lucide-react';
import { api } from '../../services/api';
import { TunnelStatus } from '../../types';

export const GlobalAccessSettings: React.FC = () => {
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [customToken, setCustomToken] = useState<string>('');
  const [pingMs, setPingMs] = useState<number | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await api.getTunnelStatus();
      setTunnel(data);
      if (data.provider) setSelectedProvider(data.provider);
    } catch (e) {
      console.error(e);
    }
  };

  const measurePing = async () => {
    try {
      const start = performance.now();
      const res = await api.pingTunnel();
      if (res && res.pong) {
        setPingMs(Math.round(performance.now() - start));
      }
    } catch {
      setPingMs(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    measurePing();
    const timer = setInterval(() => {
      fetchStatus();
      measurePing();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    if (tunnel?.public_url) {
      navigator.clipboard.writeText(tunnel.public_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleStart = async (p?: string) => {
    setLoading(true);
    try {
      const res = await api.startTunnel(p || selectedProvider, undefined, customToken || undefined);
      setTunnel(res);
    } catch (e: any) {
      alert(e.message || 'Failed to start tunnel');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await api.stopTunnel();
      setTunnel(res);
    } catch (e: any) {
      alert(e.message || 'Failed to stop tunnel');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (p?: string) => {
    setLoading(true);
    try {
      const res = await api.restartTunnel(p || selectedProvider);
      setTunnel(res);
    } catch (e: any) {
      alert(e.message || 'Failed to restart tunnel');
    } finally {
      setLoading(false);
    }
  };

  const isLive = tunnel?.status === 'active' && Boolean(tunnel?.public_url);
  const isStarting = tunnel?.status === 'starting';

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Global Access Anywhere (No Tailscale Required)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Connect to SMART REMOTE from any mobile device, cellular network (4G/5G), or remote location.
          </p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-mono rounded-full font-bold border ${
          isLive ? 'bg-green-500/20 text-green-400 border-green-500/40' :
          isStarting ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' :
          'bg-rose-500/20 text-rose-400 border-rose-500/40'
        }`}>
          {isLive ? '● ONLINE' : isStarting ? '◌ STARTING' : '○ STOPPED'}
        </span>
      </div>

      {/* Live URL & QR Preview Card */}
      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Public Encrypted HTTPS URL</span>
          {pingMs !== null && (
            <span className="text-[11px] font-mono text-green-400">
              RTT Ping: {pingMs}ms
            </span>
          )}
        </div>

        {isLive && tunnel?.public_url ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <input
                type="text"
                readOnly
                value={tunnel.public_url}
                className="flex-1 bg-transparent px-2.5 py-1.5 text-xs font-mono text-cyan-300 font-semibold focus:outline-none select-all"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  copied ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={tunnel.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {tunnel?.qr_code_svg && (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                  <div
                    className="w-28 h-28 [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: tunnel.qr_code_svg }}
                  />
                </div>
                <div className="space-y-1.5 text-left text-xs">
                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    Scan with Samsung A36 or any phone camera
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Point your camera at this QR code. Open the link in Chrome or Samsung Internet, and log in with{' '}
                    <code className="text-cyan-300 font-mono font-bold">ARYAN</code> / <code className="text-cyan-300 font-mono font-bold">Aryan@2007</code>.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-slate-400 text-xs">
            {isStarting ? (
              <div className="flex items-center justify-center gap-2 text-cyan-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Establishing secure HTTPS tunnel connection...</span>
              </div>
            ) : (
              <span>Global tunnel is currently stopped. Click below to start.</span>
            )}
          </div>
        )}

        {/* Tunnel Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400">
            Provider: <span className="font-semibold text-slate-200">{tunnel?.active_provider || 'None'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRestart()}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Restart
            </button>
            {isLive ? (
              <button
                onClick={handleStop}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Square className="w-3.5 h-3.5" />
                Stop Tunnel
              </button>
            ) : (
              <button
                onClick={() => handleStart()}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-400 transition-colors disabled:opacity-50 shadow-md shadow-cyan-500/20"
              >
                <Play className="w-3.5 h-3.5" />
                Start Tunnel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Provider Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300">Choose Tunnel Provider</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(tunnel?.available_providers || [
            { id: 'auto', name: 'Smart Auto', description: 'Cloudflare edge or SSH fallback' },
            { id: 'localhost.run', name: 'SSH Reverse Tunnel', description: 'Instant Let\'s Encrypt HTTPS, zero setup' },
            { id: 'cloudflare', name: 'Cloudflare Quick Tunnel', description: 'Global Cloudflare Anycast edge' },
            { id: 'pinggy', name: 'Pinggy.io Tunnel', description: 'Public HTTP/HTTPS reverse tunnel' }
          ]).map((prov) => (
            <div
              key={prov.id}
              onClick={() => {
                setSelectedProvider(prov.id);
                handleRestart(prov.id);
              }}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                selectedProvider === prov.id
                  ? 'bg-cyan-950/30 border-cyan-500/60 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-100">{prov.name}</span>
                <input
                  type="radio"
                  checked={selectedProvider === prov.id}
                  onChange={() => {}}
                  className="accent-cyan-500"
                />
              </div>
              <p className="text-[10px] text-slate-400">{prov.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Logs */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          Tunnel Console Output
        </label>
        <div className="p-3 bg-black/90 border border-slate-800/80 rounded-xl font-mono text-[11px] text-emerald-400 h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {tunnel?.logs && tunnel.logs.length > 0 ? (
            tunnel.logs.map((line, idx) => (
              <div key={idx} className="hover:bg-white/5 px-1 py-0.5 rounded">
                {line}
              </div>
            ))
          ) : (
            <div className="text-slate-600 italic">No tunnel logs yet. Click 'Start Tunnel' to activate.</div>
          )}
        </div>
      </div>
    </div>
  );
};
