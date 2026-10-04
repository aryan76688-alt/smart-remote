import React, { useState, useEffect } from 'react';
import {
  Workflow, Zap, Play, CheckCircle2, AlertTriangle, ExternalLink,
  Shield, Bell, Battery, Mic, Camera, RefreshCw, Settings2, Copy, Check
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export const N8nPage: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();

  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    enabled: true,
    n8n_base_url: 'http://localhost:5678',
    webhook_url: 'http://localhost:5678/webhook/smart-remote',
    triggers: {
      cctv_motion: true,
      battery_alert: true,
      face_auth: true,
      voice_command: true,
      system_event: true
    }
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const fetchStatusAndConfig = async () => {
    try {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([
        api.getN8nStatus().catch(() => null),
        api.getN8nConfig().catch(() => null)
      ]);
      if (sRes) setStatus(sRes);
      if (cRes) setConfig(cRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndConfig();
    const interval = setInterval(fetchStatusAndConfig, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      triggerHaptic(30);
      const res = await api.updateN8nConfig(config);
      if (res.success) {
        addNotification('n8n Saved', 'n8n workflow settings updated successfully.', 'success');
        fetchStatusAndConfig();
      }
    } catch (err: any) {
      addNotification('Save Failed', err.message || 'Error updating config', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTrigger = async (eventType: string) => {
    try {
      triggerHaptic(40);
      setTestResult(`Sending test '${eventType}'...`);
      const res = await api.testN8nTrigger({
        event: eventType,
        data: {
          timestamp: new Date().toISOString(),
          message: `Test trigger for ${eventType} dispatched from Smart Remote!`,
          battery: 85,
          caller: 'Aryan'
        }
      });
      if (res.success) {
        setTestResult(`✓ Successfully dispatched '${eventType}' to n8n!`);
        addNotification('Trigger Dispatched', `Sent test '${eventType}' to n8n webhook.`, 'success');
      } else {
        setTestResult(`Failed: ${res.error || 'Check n8n connection'}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    }
  };

  const copyIncomingActionUrl = () => {
    const fullUrl = `${window.location.origin}/api/n8n/action`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(true);
    triggerHaptic(20);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const isOnline = status?.online;

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 space-y-5 pb-24 font-sans select-none">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-violet-950/60 via-slate-900/80 to-cyan-950/60 border border-violet-500/30 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-violet-600/20 border border-violet-500/40 text-violet-400 shadow-lg shadow-violet-500/20">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-100 tracking-wide font-mono">
                n8n SMART WORKFLOW HUB
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {isOnline ? '● ACTIVE & READY' : '○ STARTING / OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Automate Kali Linux with smart visual workflows, webhooks &amp; multi-service integrations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href={config.n8n_base_url || 'http://localhost:5678'}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-violet-600/30 active:scale-95 transition-all"
          >
            <span>OPEN n8n EDITOR</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={fetchStatusAndConfig}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 active:scale-95 transition-all"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Test Triggers Card */}
      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Instant Workflow Test Triggers</span>
          </div>
          <span className="text-[10px] text-slate-500">1-Tap Webhook Dispatch</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={() => handleTestTrigger('cctv_motion')}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 flex items-center space-x-2.5 active:scale-95 transition-all text-left"
          >
            <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-200 font-mono">CCTV Motion</div>
              <div className="text-[10px] text-slate-500">Trigger motion workflow</div>
            </div>
          </button>

          <button
            onClick={() => handleTestTrigger('battery_alert')}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 flex items-center space-x-2.5 active:scale-95 transition-all text-left"
          >
            <Battery className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-200 font-mono">Battery Alert</div>
              <div className="text-[10px] text-slate-500">Low/Overcharge trigger</div>
            </div>
          </button>

          <button
            onClick={() => handleTestTrigger('voice_command')}
            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-violet-500/50 flex items-center space-x-2.5 active:scale-95 transition-all text-left"
          >
            <Mic className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-200 font-mono">Voice / AI Event</div>
              <div className="text-[10px] text-slate-500">Trigger AI webhook</div>
            </div>
          </button>
        </div>

        {testResult && (
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}
      </div>

      {/* Webhook Configuration Form */}
      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2 font-mono text-xs font-bold text-slate-200 uppercase">
          <Settings2 className="w-4 h-4 text-cyan-400" />
          <span>Webhook Configuration</span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Outgoing n8n Webhook URL (Smart Remote ➔ n8n):</label>
            <input
              type="text"
              value={config.webhook_url || ''}
              onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
              placeholder="http://localhost:5678/webhook/smart-remote"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:border-violet-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block font-sans">
              Smart Remote sends JSON events to this webhook URL automatically when triggers occur.
            </span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Incoming Kali Action Endpoint (n8n ➔ Smart Remote):</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/n8n/action`}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs cursor-pointer select-all"
              />
              <button
                onClick={copyIncomingActionUrl}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center space-x-1"
                title="Copy URL"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block font-sans">
              Send POST with JSON: <code>&#123; "action": "lock_screen" | "screen_off" | "speak" | "set_volume" &#125;</code> to command Kali Linux from n8n!
            </span>
          </div>
        </div>

        {/* Triggers selection */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="text-xs font-mono font-bold text-slate-300">Automatic Event Triggers:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'cctv_motion', label: 'CCTV Motion Detected', desc: 'Sends alert with timestamp & motion coordinates' },
              { key: 'battery_alert', label: 'Battery Overcharge / Low', desc: 'Dispatches when battery hits 20% or 80%' },
              { key: 'face_auth', label: 'Face Auth Unlock Events', desc: 'Triggers on security unlocks' },
              { key: 'voice_command', label: 'AI & Voice Commands', desc: 'Dispatches spoken commands to n8n' }
            ].map((t) => (
              <label
                key={t.key}
                className="flex items-start space-x-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-all"
              >
                <input
                  type="checkbox"
                  checked={Boolean(config.triggers?.[t.key])}
                  onChange={(e) => {
                    const next = { ...config.triggers, [t.key]: e.target.checked };
                    setConfig({ ...config, triggers: next });
                  }}
                  className="mt-1 accent-violet-500 rounded"
                />
                <div>
                  <div className="text-xs font-bold text-slate-200 font-mono">{t.label}</div>
                  <div className="text-[10px] text-slate-400 font-sans">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-mono font-bold text-xs shadow-lg shadow-violet-600/30 active:scale-95 transition-all flex items-center justify-center space-x-2"
        >
          <span>{saving ? 'SAVING...' : 'SAVE n8n CONFIGURATION'}</span>
        </button>
      </div>
    </div>
  );
};

export default N8nPage;
