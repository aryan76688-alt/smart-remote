import React, { useState, useEffect } from 'react';
import {
  Terminal, Wifi, Bell, Mic, MicOff, Maximize, Minimize,
  Settings, Smartphone, Monitor, ShieldAlert, X,
  Unlock, Radio, Server, LogOut, Sun, Moon, MoreVertical, Globe, Video
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useVoice } from '../../context/VoiceContext';
import { useCall } from '../../context/CallContext';
import { api } from '../../services/api';
import { GlobalAccessModal } from './GlobalAccessModal';
import { AppLogo } from './AppLogo';

interface TopBarProps {
  onOpenNotifications: () => void;
  onSwitchDevice?: () => void;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenNotifications, onSwitchDevice, onLogout
}) => {
  const {
    activeRoute, setActiveRoute,
    serverOnline, tailscaleIp, notifications, theme, setTheme, addNotification,
    isApk, triggerHaptic, openServerSettings, registerBackHandler
  } = useApp();
  const { latencyMs } = useWebSocket();
  const {
    startListening, stopListening, voiceState
  } = useVoice();
  const { startCall, callState } = useCall();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showGlobalModal, setShowGlobalModal] = useState<boolean>(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mobile Back Button integration: Close open popups when user hits Back
  useEffect(() => {
    if (!mobileMenuOpen && !showGlobalModal && !showWarning) return;
    return registerBackHandler(() => {
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        return true;
      }
      if (showGlobalModal) {
        setShowGlobalModal(false);
        return true;
      }
      if (showWarning) {
        setShowWarning(false);
        return true;
      }
      return false;
    });
  }, [mobileMenuOpen, showGlobalModal, showWarning, registerBackHandler]);

  const themes = [
    { id: 'cyberpunk', name: 'Cyber Dark', color: '#06b6d4', isLight: false },
    { id: 'kali', name: 'Kali Dragon', color: '#00a2ff', isLight: false },
    { id: 'matrix', name: 'Matrix Green', color: '#22c55e', isLight: false },
    { id: 'dracula', name: 'Dracula Violet', color: '#bd93f9', isLight: false },
    { id: 'nord', name: 'Nord Arctic', color: '#38bdf8', isLight: false },
    { id: 'oled', name: 'AMOLED Black', color: '#ffffff', isLight: false },
    { id: 'light', name: 'Clean Light', color: '#0284c7', isLight: true },
    { id: 'cyber-light', name: 'Cyber Light', color: '#0891b2', isLight: true },
    { id: 'solarized-light', name: 'Solarized Light', color: '#b58900', isLight: true },
    { id: 'nord-light', name: 'Nord Light', color: '#5e81ac', isLight: true },
  ];

  const cycleTheme = () => {
    triggerHaptic(30);
    const currentIndex = themes.findIndex(t => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const next = themes[nextIndex];
    setTheme(next.id);
    addNotification('Theme Changed', `Activated ${next.name} (${next.isLight ? 'Light' : 'Dark'}) theme`, 'info');
  };

  const handleUnlockScreen = async () => {
    triggerHaptic(50);
    setUnlocking(true);
    try {
      const res = await api.unlockScreen();
      if (res.success) {
        addNotification('Screen Awakened', 'Workstation display awakened and unlocked.', 'success');
      } else {
        addNotification('Unlock Triggered', 'Wake-up command sent to display.', 'info');
      }
    } catch {
      addNotification('Unlock Failed', 'Could not reach display unlock service.', 'warning');
    } finally {
      setTimeout(() => setUnlocking(false), 600);
    }
  };

  const toggleFullscreen = () => {
    triggerHaptic(30);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const currentThemeObj = themes.find(t => t.id === theme) || themes[0];

  return (
    <>
      <header className="safe-top min-h-[3.5rem] border-b border-cyber-border bg-cyber-surface/95 backdrop-blur-md px-3 sm:px-4 py-2 flex items-center justify-between z-30 select-none relative">
        {/* Left: Brand / Logo & System Status */}
        <div className="flex items-center space-x-2.5">
          <div
            onClick={() => {
              triggerHaptic(25);
              setActiveRoute('/dashboard');
            }}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <AppLogo size={32} className="group-hover:scale-105 transition-transform" />
            <div className="flex flex-col justify-center">
              <div className="text-xs font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5 leading-tight">
                <span>SMART REMOTE</span>
                {isApk ? (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                    NATIVE
                  </span>
                ) : (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-400/40">
                    2.0
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-[9px] font-mono text-slate-400 leading-none">
                  {serverOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="text-[9px] font-mono text-slate-600">&bull;</span>
                <span className="text-[9px] font-mono text-cyan-400/80 leading-none">
                  {latencyMs}ms
                </span>
              </div>
            </div>
          </div>

          {/* Web-only APK download pill (NEVER shown inside native APK) */}
          {!isApk && (
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="hidden xs:flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 font-mono text-[9px] font-bold active:scale-95 ml-1"
              title="Download Android APK"
            >
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span>APK</span>
            </a>
          )}
        </div>

        {/* Center / Desktop Info (hidden on small phone screens) */}
        <div className="hidden md:flex items-center space-x-3 text-xs">
          <button
            onClick={() => setShowWarning(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[11px] hover:bg-cyan-500/20 transition-colors"
          >
            <Wifi className="w-3 h-3" />
            <span>{tailscaleIp}</span>
          </button>
        </div>

        {/* Right Section: Clean, Minimalist (Voice Button + More Menu) */}
        <div className="flex items-center space-x-2">
          {/* Desktop-only expanded shortcut buttons */}
          <div className="hidden lg:flex items-center space-x-1.5">
            <button
              onClick={() => setShowGlobalModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
              title="Global Access Anywhere"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono font-bold tracking-wider">GLOBAL</span>
            </button>

            <button
              onClick={handleUnlockScreen}
              disabled={unlocking}
              className={`p-2 rounded-lg border transition-all flex items-center space-x-1 ${
                unlocking
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10'
              }`}
              title="Unlock & Wake Workstation Screen"
            >
              <Unlock className="w-4 h-4" />
              <span className="text-[10px] font-mono">UNLOCK</span>
            </button>

            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/50 transition-colors flex items-center space-x-1"
              title={`Theme: ${currentThemeObj.name}`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                style={{ backgroundColor: currentThemeObj.color }}
              />
            </button>

            <button
              onClick={onOpenNotifications}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Two-Way Video Call Button */}
          <button
            onClick={() => {
              triggerHaptic(40);
              startCall();
            }}
            className="px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-mono font-bold text-[10px] flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Start Two-Way Video Call with Kali Laptop"
          >
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">CALL</span>
          </button>

          {/* Voice Assistant Button (Thumb-Friendly, Non-Overlapping) */}
          <button
            onClick={() => {
              triggerHaptic(40);
              if (voiceState === 'listening') {
                stopListening();
              } else {
                startListening();
              }
            }}
            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
              voiceState === 'listening'
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse shadow-rose-500/30'
                : 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 border-cyan-400 font-bold shadow-cyan-500/20'
            }`}
            title="Voice Assistant / Push-To-Talk"
          >
            {voiceState === 'listening' ? (
              <MicOff className="w-4 h-4 animate-bounce" />
            ) : (
              <Mic className="w-4 h-4 stroke-[2.5]" />
            )}
            <span className="text-[10px] font-mono font-bold">
              {voiceState === 'listening' ? 'LIVE' : 'MIC'}
            </span>
          </button>

          {/* Single Clean Mobile Menu Button (⋮) */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic(25);
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 flex items-center justify-center relative"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4 text-cyan-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </button>

            {/* Mobile Dropdown Popover */}
            {mobileMenuOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div
                  className="absolute top-16 right-3 w-64 bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-2xl p-2.5 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-400 uppercase tracking-wider border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>Quick Controls</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {isApk ? 'Native App' : 'Web View'}
                    </span>
                  </div>

                  {/* Server IP Settings (Directly triggers native Android dialog inside APK) */}
                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      setMobileMenuOpen(false);
                      openServerSettings();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-900 active:bg-slate-800 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Server IP / Connection</span>
                  </button>

                  {/* Web-only Download APK link */}
                  {!isApk && (
                    <a
                      href="/SmartRemote.apk"
                      download="SmartRemote.apk"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 font-bold transition-all shadow-sm active:scale-98"
                    >
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-4 h-4 text-slate-950" />
                        <span>Download Android APK</span>
                      </div>
                      <span className="text-[10px] font-mono font-black">&darr;</span>
                    </a>
                  )}

                  {/* Global Remote Access */}
                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      setMobileMenuOpen(false);
                      setShowGlobalModal(true);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-cyan-300 hover:bg-cyan-950/40 bg-cyan-950/20 border border-cyan-500/30 transition-colors text-left font-semibold"
                  >
                    <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Global Access (No Tailscale)</span>
                  </button>

                  {/* Unlock Workstation Screen */}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleUnlockScreen();
                    }}
                    disabled={unlocking}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-amber-300 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <Unlock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{unlocking ? 'Waking Screen...' : 'Unlock / Wake Display'}</span>
                  </button>

                  {/* Notification Center */}
                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      setMobileMenuOpen(false);
                      onOpenNotifications();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-900 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Bell className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Notifications</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Cycle Theme */}
                  <button
                    onClick={() => {
                      cycleTheme();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-900 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: currentThemeObj.color }}
                      />
                      <span>Cycle Theme</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentThemeObj.name.split(' ')[0]}
                    </span>
                  </button>

                  {/* Toggle Fullscreen */}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      toggleFullscreen();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-900 transition-colors text-left"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Maximize className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                  </button>

                  {/* Switch Machine */}
                  {onSwitchDevice && (
                    <button
                      onClick={() => {
                        triggerHaptic(30);
                        setMobileMenuOpen(false);
                        onSwitchDevice();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-900 transition-colors text-left"
                    >
                      <Server className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Switch Machine</span>
                    </button>
                  )}

                  {/* Log Out */}
                  {onLogout && (
                    <button
                      onClick={() => {
                        triggerHaptic(40);
                        setMobileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left border-t border-slate-800/80 mt-1 pt-2"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Network Security Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-cyber-border rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-cyan-400">
              <Wifi className="w-6 h-6" />
              <h3 className="font-bold text-sm tracking-wide uppercase text-slate-100">
                Tailscale Network Route
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This controller operates over private Tailscale tunnel at <code className="text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">{tailscaleIp}:7070</code>. Ensure target machine and mobile phone are authenticated on the same tailnet.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowWarning(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Access Anywhere Modal */}
      <GlobalAccessModal
        isOpen={showGlobalModal}
        onClose={() => setShowGlobalModal(false)}
      />
    </>
  );
};
export default TopBar;
