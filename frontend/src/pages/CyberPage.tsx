import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Radio, Globe, Terminal, Wifi, Skull, RefreshCw,
  Copy, Check, Play, Square, AlertTriangle, Zap, EyeOff, Camera, Lock,
  ExternalLink, Download
} from 'lucide-react';
import { api } from '../services/api';

export const CyberPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'radar' | 'intruder' | 'tor' | 'payload' | 'wifi' | 'listeners'>('radar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intruder Trap state
  const [intruderStatus, setIntruderStatus] = useState<any>({ armed: false, honeypot: true, events: [] });
  const [intruderSnapshots, setIntruderSnapshots] = useState<any[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  // Radar state
  const [connections, setConnections] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState('');

  // Tor state
  const [torStatus, setTorStatus] = useState<any>(null);
  const [torRenewing, setTorRenewing] = useState(false);

  // Payload state
  const [payloadType, setPayloadType] = useState('bash');
  const [lhost, setLhost] = useState('100.69.194.11');
  const [lport, setLport] = useState(4444);
  const [generatedPayload, setGeneratedPayload] = useState('');
  const [copied, setCopied] = useState(false);
  const [stagerRunning, setStagerRunning] = useState(false);
  const [stagerUrl, setStagerUrl] = useState('');

  // Wi-Fi state
  const [wifiNetworks, setWifiNetworks] = useState<any[]>([]);

  // Listeners state
  const [listeners, setListeners] = useState<any[]>([]);

  // ── Load Radar ──
  const fetchRadar = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getNetworkRadar();
      if (res.success) {
        setConnections(res.connections || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch network radar');
    } finally {
      setLoading(false);
    }
  };

  // ── Load Tor ──
  const fetchTor = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTorStatus();
      setTorStatus(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Tor status');
    } finally {
      setLoading(false);
    }
  };

  const handleRenewTor = async () => {
    try {
      setTorRenewing(true);
      const res = await api.renewTorCircuit();
      alert(res.message || 'Circuit renewed');
      await fetchTor();
    } catch (err: any) {
      alert(err.message || 'Failed to renew circuit');
    } finally {
      setTorRenewing(false);
    }
  };

  // ── Generate Payload ──
  const handleGeneratePayload = async () => {
    try {
      setLoading(true);
      const res = await api.generatePayload(payloadType, lhost, lport);
      setGeneratedPayload(res.command || '');
    } catch (err: any) {
      alert(err.message || 'Failed to generate payload');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(generatedPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleStager = async (action: 'start' | 'stop') => {
    try {
      setLoading(true);
      const res = await api.togglePayloadStager(action, 8888, generatedPayload);
      setStagerRunning(res.running);
      if (res.url) setStagerUrl(res.url);
    } catch (err: any) {
      alert(err.message || 'Stager toggle failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Wi-Fi ──
  const fetchWifi = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.scanWifi();
      if (res.success) {
        setWifiNetworks(res.networks || []);
      }
    } catch (err: any) {
      setError(err.message || 'Wi-Fi scan failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Listeners ──
  const fetchListeners = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCyberListeners();
      setListeners(res.listeners || []);
    } catch (err: any) {
      setError(err.message || 'Failed to probe listeners');
    } finally {
      setLoading(false);
    }
  };

  // ── Intruder Trap & Decoy ──
  const fetchIntruder = async () => {
    try {
      setLoading(true);
      setError(null);
      const [status, snaps] = await Promise.all([
        api.getIntruderStatus(),
        api.getIntruderSnapshots()
      ]);
      setIntruderStatus(status);
      setIntruderSnapshots(snaps.snapshots || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch intruder trap state');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArm = async () => {
    try {
      if (intruderStatus.armed) {
        await api.disarmIntruderTrap();
      } else {
        await api.armIntruderTrap({ honeypot: intruderStatus.honeypot });
      }
      await fetchIntruder();
    } catch (err: any) {
      alert(`Error toggling trap: ${err.message}`);
    }
  };

  const handleTestTrigger = async () => {
    try {
      await api.testTriggerIntruder();
      alert('Silent snapshot triggered! Captured photo available in gallery below.');
      await fetchIntruder();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    }
  };

  const handleLaunchDecoy = async () => {
    try {
      await api.launchDecoyScreen();
      alert('Decoy screen launched in fullscreen kiosk mode on Kali Linux monitor.');
    } catch (err: any) {
      alert(`Decoy launch failed: ${err.message}`);
    }
  };

  const handleCloseDecoy = async () => {
    try {
      await api.closeDecoyScreen();
    } catch (err: any) {
      alert(`Decoy close failed: ${err.message}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'radar') fetchRadar();
    else if (activeTab === 'intruder') fetchIntruder();
    else if (activeTab === 'tor') fetchTor();
    else if (activeTab === 'payload') handleGeneratePayload();
    else if (activeTab === 'wifi') fetchWifi();
    else if (activeTab === 'listeners') fetchListeners();
  }, [activeTab]);

  const filteredConnections = connections.filter(c => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (c.process && c.process.toLowerCase().includes(q)) ||
      (c.local && c.local.toLowerCase().includes(q)) ||
      (c.remote && c.remote.toLowerCase().includes(q)) ||
      (c.protocol && c.protocol.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 pb-24">
      {/* Cockpit Header */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-rose-500/30 p-4 rounded-2xl shadow-lg backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              CYBER & PENTESTING COCKPIT
              <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded-full font-mono">
                RED TEAM
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Socket Radar • Tor Gateway • Reverse Stager</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'radar') fetchRadar();
            else if (activeTab === 'intruder') fetchIntruder();
            else if (activeTab === 'tor') fetchTor();
            else if (activeTab === 'payload') handleGeneratePayload();
            else if (activeTab === 'wifi') fetchWifi();
            else if (activeTab === 'listeners') fetchListeners();
          }}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
          title="Refresh active view"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
        {[
          { id: 'radar', label: 'RADAR', icon: Radio },
          { id: 'intruder', label: 'TRAP/DECOY', icon: EyeOff },
          { id: 'tor', label: 'TOR', icon: Globe },
          { id: 'payload', label: 'PAYLOAD', icon: Skull },
          { id: 'wifi', label: 'WI-FI', icon: Wifi },
          { id: 'listeners', label: 'LISTEN', icon: Terminal }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold tracking-wider transition-all ${
                isActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
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

      {/* ── TAB 1: NETWORK RADAR ── */}
      {activeTab === 'radar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Filter socket by IP, process, or port..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <span className="text-xs font-mono text-slate-400 shrink-0">
              {filteredConnections.length} Active
            </span>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredConnections.map((conn, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      conn.protocol === 'TCP' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {conn.protocol}
                    </span>
                    <span className="text-slate-200 font-bold truncate">
                      {conn.process || 'kernel/unknown'}
                    </span>
                    {conn.pid && (
                      <span className="text-[10px] text-slate-400">PID: {conn.pid}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    <span className="text-emerald-400">{conn.local}</span> &rarr;{' '}
                    <span className="text-rose-400">{conn.remote}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">State: {conn.state}</div>
                </div>

                {conn.pid && (
                  <button
                    onClick={async () => {
                      if (confirm(`Kill PID ${conn.pid} (${conn.process})?`)) {
                        await api.killSocket(conn.pid);
                        fetchRadar();
                      }
                    }}
                    className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs shrink-0 active:scale-95"
                    title="Kill Process PID"
                  >
                    Kill
                  </button>
                )}
              </div>
            ))}
            {filteredConnections.length === 0 && !loading && (
              <div className="text-center py-10 text-slate-500 text-xs">
                No matching connections found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: TOR CONTROLLER ── */}
      {activeTab === 'tor' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-sm text-slate-200">Tor Anonymity Gateway</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                torStatus?.tor_running ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}>
                {torStatus?.tor_running ? 'DAEMON ACTIVE' : 'STOPPED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Public Exit IP</div>
                <div className="text-cyan-300 font-bold mt-1">{torStatus?.public_ip || 'Probing...'}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="text-slate-400 text-[10px]">SOCKS5 Port</div>
                <div className="text-emerald-300 font-bold mt-1">
                  {torStatus?.socks_open ? '127.0.0.1:9050 (OPEN)' : 'CLOSED'}
                </div>
              </div>
            </div>

            <button
              onClick={handleRenewTor}
              disabled={torRenewing}
              className="w-full py-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${torRenewing ? 'animate-spin' : ''}`} />
              RENEW CIRCUIT (NEWNYM / NEW IP)
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: PAYLOAD GENERATOR & STAGER ── */}
      {activeTab === 'payload' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Type</label>
                <select
                  value={payloadType}
                  onChange={e => setPayloadType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="bash">Bash TCP</option>
                  <option value="python">Python3</option>
                  <option value="netcat">Netcat (nc -e)</option>
                  <option value="powershell">PowerShell</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">LHOST (Tailscale)</label>
                <input
                  type="text"
                  value={lhost}
                  onChange={e => setLhost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">LPORT</label>
                <input
                  type="number"
                  value={lport}
                  onChange={e => setLport(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleGeneratePayload}
              className="w-full py-2.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-200 font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Zap className="w-4 h-4" /> GENERATE PAYLOAD
            </button>

            {generatedPayload && (
              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    readOnly
                    rows={4}
                    value={generatedPayload}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none resize-none"
                  />
                  <button
                    onClick={handleCopyPayload}
                    className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300"
                    title="Copy Payload"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* HTTP Stager Server */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono min-w-0">
                    <div className="text-slate-400 text-[10px]">HTTP Stager Port 8888</div>
                    <div className="text-cyan-400 truncate">
                      {stagerRunning ? (stagerUrl || `http://${lhost}:8888/payload.sh`) : 'Stager offline'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStager(stagerRunning ? 'stop' : 'start')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
                      stagerRunning
                        ? 'bg-rose-950 text-rose-300 border border-rose-600'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    }`}
                  >
                    {stagerRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {stagerRunning ? 'STOP' : 'HOST STAGER'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: WI-FI SCANNER ── */}
      {activeTab === 'wifi' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              {wifiNetworks.length} APs Discovered
            </span>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {wifiNetworks.map((net, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-bold truncate">
                      {net.ssid || '[Hidden SSID]'}
                    </span>
                    <span className="text-[10px] text-slate-400">{net.security}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    BSSID: {net.bssid} • CH {net.channel}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold ${
                    net.signal > 70 ? 'text-emerald-400' : net.signal > 40 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {net.signal}%
                  </span>
                </div>
              </div>
            ))}
            {wifiNetworks.length === 0 && !loading && (
              <div className="text-center py-10 text-slate-500 text-xs">
                No Wi-Fi networks discovered or interface busy.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: LISTENERS ── */}
      {activeTab === 'listeners' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {listeners.map((lst, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div>
                  <div className="text-slate-200 font-bold flex items-center gap-2">
                    <span>PORT {lst.port}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      lst.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {lst.active ? 'LISTENING' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {lst.service || 'Reverse Shell Sentinel'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 6: INTRUDER TRAP & HONEYPOT DECOY ── */}
      {activeTab === 'intruder' && (
        <div className="space-y-4">
          {/* Trap Control Panel */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-rose-950/30 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl ${intruderStatus.armed ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">SILENT INTRUDER TRAP</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Webcam Snapshots • AC/Lid Tamper • Fake OS Decoy</p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                intruderStatus.armed ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {intruderStatus.armed ? 'ARMED & WATCHING' : 'DISARMED'}
              </span>
            </div>

            {/* Arm / Disarm Toggle Button */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleToggleArm}
                className={`py-3 px-4 rounded-xl font-bold text-xs font-mono flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-md ${
                  intruderStatus.armed
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black shadow-emerald-600/30'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{intruderStatus.armed ? 'DISARM INTRUDER TRAP' : 'ARM SURVEILLANCE TRAP'}</span>
              </button>

              <button
                onClick={handleTestTrigger}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs font-mono flex items-center justify-center space-x-2 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>TEST TRIGGER (SNAP NOW)</span>
              </button>
            </div>

            {/* Honeypot Decoy Screen Actions */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-300 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Honeypot Decoy: Fake Windows/Kali Update Screen</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleLaunchDecoy}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold font-mono hover:bg-cyan-900 active:scale-95"
                >
                  LAUNCH DECOY NOW
                </button>
                <button
                  onClick={handleCloseDecoy}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold font-mono hover:bg-slate-700 active:scale-95"
                >
                  CLOSE DECOY
                </button>
              </div>
            </div>
          </div>

          {/* Captured Photos Gallery */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-slate-300 flex items-center gap-2">
                <span>CAPTURED INTRUDER PHOTOS</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  {intruderSnapshots.length} PHOTOS
                </span>
              </h3>
            </div>

            {intruderSnapshots.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-mono">No intruder snapshots recorded yet.</p>
                <p className="text-[10px] text-slate-500">When armed, any charger disconnect or physical tamper snaps a photo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {intruderSnapshots.map((snap, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedSnapshot(snap.url)}
                    className="group relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer hover:border-cyan-400 transition-all shadow-md"
                  >
                    <img
                      src={snap.url}
                      alt="Intruder capture"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="text-[9px] font-mono text-slate-200 truncate">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div
          onClick={() => setSelectedSnapshot(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        >
          <div className="relative max-w-2xl w-full bg-slate-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={selectedSnapshot} alt="Enlarged Intruder Capture" className="w-full h-auto object-contain max-h-[75vh]" />
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-300">Intruder Evidence Capture</span>
              <div className="flex items-center space-x-2">
                <a
                  href={selectedSnapshot}
                  download="intruder_evidence.jpg"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-mono text-xs flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
