import React, { useEffect, useState } from 'react';
import {
  Settings, Wifi, Shield, Cpu, Mic,
  Check, Smartphone, Globe, Power
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { GlobalAccessSettings } from '../components/settings/GlobalAccessSettings';

export const SettingsPage: React.FC = () => {
  const {
    deviceMode, setDeviceMode, tailscaleIp, addNotification, theme, setTheme,
    isApk, triggerHaptic, openServerSettings
  } = useApp();
  const [activeSection, setActiveSection] = useState<string>('general');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [autostartEnabled, setAutostartEnabled] = useState<boolean>(true);
  const [autostartLoading, setAutostartLoading] = useState<boolean>(false);

  useEffect(() => {
    api.getSettings().then(s => {
      setSettings(s);
      if (s.theme) {
        setTheme(s.theme);
      }
    }).catch(() => {});

    api.getAutostart().then(res => {
      setAutostartEnabled(res.enabled);
    }).catch(() => {});
  }, []);

  const handleToggleAutostart = async (enable: boolean) => {
    setAutostartLoading(true);
    try {
      const res = await api.toggleAutostart(enable);
      setAutostartEnabled(res.enabled);
      addNotification(
        enable ? 'Auto-Start Enabled' : 'Auto-Start Disabled',
        enable ? 'Smart Remote will automatically start when Kali Linux boots and you log in.' : 'Auto-start service removed.',
        'success'
      );
    } catch {
      addNotification('Auto-Start Error', 'Failed to update auto-start configuration.', 'error');
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleChange = (key: string, val: string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    if (key === 'theme') {
      setTheme(val);
      addNotification('Theme Applied', `Switched theme to ${val.toUpperCase()}`, 'info');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      addNotification('Settings Saved', 'Preferences updated successfully', 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'general', label: 'General & Themes', icon: Settings },
    { id: 'global', label: 'Global Access (Anywhere)', icon: Globe },
    { id: 'connection', label: 'Connection', icon: Wifi },
    { id: 'remote', label: 'Remote & Input', icon: Smartphone },
    { id: 'terminal', label: 'Terminal', icon: Cpu },
    { id: 'voice', label: 'Voice & AI', icon: Mic },
    { id: 'security', label: 'Security & Access', icon: Shield },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] bg-cyber-bg max-w-6xl mx-auto w-full select-none pb-20">
      {/* Settings Navigation */}
      <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-cyber-border p-3 flex md:flex-col space-x-1 md:space-x-0 md:space-y-1 overflow-x-auto shrink-0">
        {sections.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6">
        {/* GENERAL */}
        {activeSection === 'general' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">General Settings</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Device Name</label>
              <input
                type="text"
                value={settings.device_name || ''}
                onChange={e => handleChange('device_name', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Native Android APK Card / Native Status */}
            {isApk ? (
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                        Native Android App Active
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                        v2.0 PRO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Running natively inside Smart Remote APK. Hardware haptics, low-latency stream, and system gesture navigation enabled.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      openServerSettings();
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Change Server IP / Connection</span>
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic(50);
                      if ((window as any).AndroidBridge?.showToast) {
                        (window as any).AndroidBridge.showToast('Smart Remote Native APK v2.0 - Running smoothly!');
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 font-medium active:scale-95 transition-all"
                  >
                    Test Native Feedback
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                        Android Native App (.APK)
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Install on your Samsung Galaxy or Android phone for full phone microphone intercom, high-speed 60FPS stream, and zero browser security context blocks.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="/SmartRemote.apk"
                    download="SmartRemote.apk"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-2 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Download Android APK</span>
                  </a>
                </div>
              </div>
            )}

            {/* Mobile Mode Lock Info */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 font-semibold">Display Profile: Mobile Only</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                LOCKED FOR MOBILE
              </span>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs text-slate-300 font-semibold">Color Theme</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'cyberpunk', name: 'Cyber Dark', desc: 'Obsidian & Neon Cyan', accent: '#06b6d4' },
                  { id: 'kali', name: 'Kali Dragon', desc: 'Midnight Navy & Electric Blue', accent: '#00a2ff' },
                  { id: 'matrix', name: 'Matrix Green', desc: 'Pure Black & Phosphor Lime', accent: '#22c55e' },
                  { id: 'dracula', name: 'Dracula Violet', desc: 'Gothic Purple & Lavender', accent: '#bd93f9' },
                  { id: 'nord', name: 'Nord Arctic', desc: 'Polar Slate & Glacier Cyan', accent: '#38bdf8' },
                  { id: 'oled', name: 'AMOLED Black', desc: 'True Pitch Black & Silver', accent: '#ffffff' },
                  { id: 'light', name: 'Clean Light', desc: 'Studio White & Ocean Blue', accent: '#0284c7' },
                  { id: 'cyber-light', name: 'Cyber Light', desc: 'Neumorphic Tech White', accent: '#0891b2' },
                  { id: 'solarized-light', name: 'Solarized Light', desc: 'Warm Solarized Cream', accent: '#b58900' },
                  { id: 'nord-light', name: 'Nord Light', desc: 'Snow Storm Frost White', accent: '#5e81ac' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleChange('theme', t.id)}
                    className={`p-3 rounded-2xl border text-left transition-all active:scale-95 space-y-1 ${
                      (settings.theme || theme) === t.id
                        ? 'border-cyan-500 bg-cyan-950/30 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full border border-white/20 shadow-sm shrink-0" style={{ backgroundColor: t.accent }} />
                      <span className="text-xs font-bold text-slate-100">{t.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Start at Boot / Login Card */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-2">
                    <Power className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100">Auto-Start at System Boot &amp; Login</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Automatically launch SMART REMOTE daemon via systemd user service and XDG desktop autostart on Kali Linux.
                  </p>
                </div>
                <button
                  disabled={autostartLoading}
                  onClick={() => handleToggleAutostart(!autostartEnabled)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all shrink-0 active:scale-95 ${
                    autostartEnabled
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {autostartLoading ? '...' : (autostartEnabled ? 'ENABLED' : 'DISABLED')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL ACCESS */}
        {activeSection === 'global' && (
          <GlobalAccessSettings />
        )}

        {/* CONNECTION */}
        {activeSection === 'connection' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Connection Settings</h3>
            
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Tailscale IP:</span>
                <span className="text-cyan-400 font-bold">{tailscaleIp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Server Port:</span>
                <span className="text-slate-200">7070</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Default URL:</span>
                <span className="text-slate-200">http://{tailscaleIp}:7070</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300">
              Ensure port 7070 is only accessed across your trusted Tailscale VPN.
            </div>
          </div>
        )}

        {/* REMOTE & INPUT */}
        {activeSection === 'remote' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Remote &amp; Input Behavior</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Touchpad Sensitivity ({settings.mouse_sensitivity || '1.0'}x)</label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={settings.mouse_sensitivity || '1.0'}
                onChange={e => handleChange('mouse_sensitivity', e.target.value)}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">D-Pad Speed Step ({settings.dpad_speed || '20'}px)</label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.dpad_speed || '20'}
                onChange={e => handleChange('dpad_speed', e.target.value)}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-300">Haptic Vibration on Tap</span>
              <input
                type="checkbox"
                checked={settings.haptic_feedback !== 'false'}
                onChange={e => handleChange('haptic_feedback', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 accent-cyan-400"
              />
            </div>
          </div>
        )}

        {/* SECURITY & ACCESS */}
        {activeSection === 'security' && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Security Architecture &amp; Access</h3>
            
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <Shield className="w-5 h-5" />
                <span>Zero-Trust Tailscale Perimeter &amp; Authentication</span>
              </div>
              <p>
                Smart Remote operates inside your encrypted Tailscale mesh network. All sessions, terminal keystrokes, and screen frames are confined to your private Tailscale IP (<code className="text-cyan-400">{tailscaleIp}</code>).
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1.5">
                <div className="flex justify-between text-slate-200 font-bold border-b border-slate-800 pb-1">
                  <span>Authorized Workstation User:</span>
                  <span className="text-cyan-400">ARYAN</span>
                </div>
                <div>• Master Username: ARYAN</div>
                <div>• Master Password: Configured (Aryan@2007)</div>
                <div>• Samsung Galaxy A36 Profile: ACTIVE (100dvh &amp; Safe Bottom)</div>
                <div>• Remote Screen Unlock: ENABLED</div>
                <div>• Path Traversal Defense: ENFORCED</div>
                <div>• Destructive Commands: CONFIRMATION REQUIRED</div>
              </div>
            </div>
          </div>
        )}

        {/* VOICE & AI & TERMINAL */}
        {['voice', 'terminal'].includes(activeSection) && (
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider capitalize">{activeSection} Preferences</h3>
            <div className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-3 text-xs text-slate-300">
              <p>Configuration profile loaded from Kali host.</p>
              <div className="flex justify-between items-center py-1">
                <span>OpenAI Voice Persona &amp; Phonetic Speech:</span>
                <span className="font-mono text-emerald-400">ENABLED</span>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 max-w-xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-500/20 active:scale-98 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
