import React, { useState, useEffect } from 'react';
import {
  Globe, X, Copy, Check, ExternalLink, RefreshCw,
  ShieldCheck, Smartphone, Wifi, Radio, AlertTriangle, Play, Square
} from 'lucide-react';
import { api } from '../../services/api';
import { TunnelStatus } from '../../types';

interface GlobalAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalAccessModal: React.FC<GlobalAccessModalProps> = ({ isOpen, onClose }) => {
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'qr' | 'settings' | 'logs'>('qr');

  const fetchStatus = async () => {
    try {
      const data = await api.getTunnelStatus();
      setTunnel(data);
      if (data.provider) setSelectedProvider(data.provider);
    } catch (e) {
      console.error('Failed to load tunnel status', e);
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
    if (isOpen) {
      fetchStatus();
      measurePing();
      const timer = setInterval(() => {
        fetchStatus();
        measurePing();
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      const res = await api.startTunnel(p || selectedProvider);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25">
              <Globe className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary tracking-wide">Global Remote Access</h3>
                <span className={`px-2 py-0.5 text-[11px] font-mono rounded-full font-semibold border ${
                  isLive ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                  isStarting ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' :
                  'bg-rose-500/20 text-rose-400 border-rose-500/40'
                }`}>
                  {isLive ? '● ONLINE' : isStarting ? '◌ CONNECTING' : '○ OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-text-secondary">Control Kali Linux anywhere worldwide without Tailscale</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border/60 bg-surface/50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'qr' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            QR & Instant Connect
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Providers & Network
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'logs' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            Live Tunnel Logs
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-5 bg-white/95 rounded-2xl shadow-inner border border-white/20 mx-auto max-w-xs">
                {isLive && tunnel?.qr_code_svg ? (
                  <div
                    className="w-56 h-56 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:drop-shadow-sm"
                    dangerouslySetInnerHTML={{ __html: tunnel.qr_code_svg }}
                  />
                ) : isStarting ? (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 text-slate-700">
                    <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-xs font-semibold">Generating global HTTPS tunnel...</p>
                  </div>
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 text-slate-700 p-3">
                    <AlertTriangle className="w-10 h-10 text-amber-500" />
                    <p className="text-xs font-semibold">Tunnel is currently stopped</p>
                    <button
                      onClick={() => handleStart()}
                      disabled={loading}
                      className="px-4 py-2 bg-primary text-slate-900 rounded-lg text-xs font-bold shadow hover:brightness-110 active:scale-95"
                    >
                      Start Tunnel Now
                    </button>
                  </div>
                )}
                <div className="mt-3 text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full border border-slate-300">
                  <Smartphone className="w-3 h-3 text-primary" />
                  Scan with Samsung Galaxy A36 / Any Phone
                </div>
              </div>

              {/* Public URL Field */}
              {isLive && tunnel?.public_url && (
                <div className="space-y-2 text-left">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary flex items-center justify-between">
                    <span>Public HTTPS URL</span>
                    {pingMs !== null && (
                      <span className="text-[10px] font-mono text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                        RTT: {pingMs}ms
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2 p-1.5 bg-surface-hover/80 border border-border rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={tunnel.public_url}
                      className="flex-1 bg-transparent px-2.5 py-1.5 text-xs font-mono text-primary font-medium focus:outline-none select-all"
                    />
                    <button
                      onClick={handleCopy}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                        copied ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-primary text-slate-900 hover:brightness-110'
                      }`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={tunnel.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      title="Open in new browser tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Instructions Card */}
              <div className="p-3.5 rounded-xl bg-surface-hover/40 border border-border text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  How to Access from Any Mobile Phone
                </div>
                <ol className="text-xs text-text-secondary space-y-1.5 pl-4 list-decimal">
                  <li>Scan the QR code above or share the HTTPS link to your phone.</li>
                  <li>Open the link in <b>Samsung Internet</b>, <b>Chrome</b>, or <b>Safari</b>.</li>
                  <li>Log in using Username: <code className="text-primary font-mono font-bold bg-primary/10 px-1 py-0.5 rounded">ARYAN</code> and Password: <code className="text-primary font-mono font-bold bg-primary/10 px-1 py-0.5 rounded">Aryan@2007</code>.</li>
                  <li>Tap browser menu <b className="text-text-primary">⋮</b> and select <b className="text-text-primary">"Add to Home screen"</b> for a full-screen app experience!</li>
                </ol>
              </div>

              {/* Quick Actions Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-text-secondary flex items-center gap-2">
                  <span className="font-mono text-[11px] text-text-secondary">
                    Active: <span className="text-text-primary font-semibold">{tunnel?.active_provider || 'None'}</span>
                  </span>
                  {tunnel?.uptime_seconds ? (
                    <span className="text-[11px] font-mono text-text-secondary">
                      ({Math.floor(tunnel.uptime_seconds / 60)}m uptime)
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRestart()}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Tunnel
                  </button>
                  {isLive ? (
                    <button
                      onClick={handleStop}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart()}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-primary text-slate-900 text-xs font-bold flex items-center gap-1.5 hover:brightness-110 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-primary">Tunnel Provider Engine</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {(tunnel?.available_providers || [
                    { id: 'auto', name: 'Auto (Smart Selection)', description: 'Cloudflare edge or SSH fallback' },
                    { id: 'localhost.run', name: 'SSH Tunnel (localhost.run)', description: 'Instant Let\'s Encrypt HTTPS, zero install' },
                    { id: 'cloudflare', name: 'Cloudflare Quick Tunnel', description: 'Global Cloudflare Anycast edge' },
                    { id: 'pinggy', name: 'Pinggy.io SSH Tunnel', description: 'Public HTTP/HTTPS reverse tunnel' }
                  ]).map((prov) => (
                    <div
                      key={prov.id}
                      onClick={() => setSelectedProvider(prov.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                        selectedProvider === prov.id
                          ? 'bg-primary/10 border-primary/40 shadow-sm'
                          : 'bg-surface-hover/30 border-border hover:bg-surface-hover/70'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-text-primary flex items-center gap-2">
                          {prov.name}
                          {selectedProvider === prov.id && (
                            <span className="px-1.5 py-0.2 text-[10px] bg-primary/20 text-primary rounded font-mono">SELECTED</span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-secondary">{prov.description}</p>
                      </div>
                      <input
                        type="radio"
                        checked={selectedProvider === prov.id}
                        onChange={() => setSelectedProvider(prov.id)}
                        className="mt-1 accent-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleRestart(selectedProvider)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-primary text-slate-900 text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Apply & Switch Provider
                </button>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span className="font-mono">Real-time Tunnel Output:</span>
                <button
                  onClick={fetchStatus}
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[11px]"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <div className="p-3 bg-black/90 border border-border/80 rounded-xl font-mono text-[11px] text-green-400 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                {tunnel?.logs && tunnel.logs.length > 0 ? (
                  tunnel.logs.map((log, idx) => (
                    <div key={idx} className="hover:bg-white/5 px-1 py-0.5 rounded">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 italic p-4 text-center">No tunnel log output available.</div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-surface-hover/20 flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Port: 7070 (Encrypted SSL)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border hover:bg-surface-hover text-text-primary transition-colors text-xs font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
