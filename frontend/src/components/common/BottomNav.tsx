import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Gamepad2, Video, Monitor, MoreHorizontal,
  Terminal, Folder, Cpu, Bot, Tv, Server, History, Settings, X, Smartphone,
  PhoneCall, Workflow, ShieldAlert, Boxes
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCall } from '../../context/CallContext';
import { api } from '../../services/api';

export const BottomNav: React.FC = () => {
  const { activeRoute, setActiveRoute, isApk, triggerHaptic, registerBackHandler } = useApp();
  const { startCall, callState } = useCall();
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [cctvRecording, setCctvRecording] = useState<boolean>(true);

  // Close More menu when Android hardware / gesture back is pressed
  useEffect(() => {
    if (!showMoreMenu) return;
    return registerBackHandler(() => {
      setShowMoreMenu(false);
      return true;
    });
  }, [showMoreMenu, registerBackHandler]);

  useEffect(() => {
    let mounted = true;
    const checkCctv = async () => {
      try {
        const stat = await api.getCctvStatus();
        if (mounted && stat) {
          setCctvRecording(Boolean(stat.is_recording));
        }
      } catch {
        // ignore
      }
    };
    checkCctv();
    const interval = setInterval(checkCctv, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const mainTabs = [
    { label: 'HOME', icon: LayoutDashboard, route: '/dashboard' },
    { label: 'REMOTE', icon: Gamepad2, route: '/remote' },
    { label: 'CCTV', icon: Video, route: '/cctv', isCctv: true },
    { label: 'MIRROR', icon: Monitor, route: '/mirror' },
  ];

  const moreItems = [
    { label: 'Cyber Cockpit', icon: ShieldAlert, route: '/cyber' },
    { label: 'DevOps & Containers', icon: Boxes, route: '/devops' },
    { label: 'Media & Clicker', icon: Tv, route: '/media' },
    { label: 'n8n Workflows', icon: Workflow, route: '/n8n' },
    { label: 'Terminal', icon: Terminal, route: '/terminal' },
    { label: 'File Manager', icon: Folder, route: '/files' },
    { label: 'System Control', icon: Cpu, route: '/system' },
    { label: 'AI Assistant', icon: Bot, route: '/assistant' },
    { label: 'Devices', icon: Server, route: '/devices' },
    { label: 'Activity Log', icon: History, route: '/history' },
    { label: 'Settings', icon: Settings, route: '/settings' },
  ];

  const handleSelect = (route: string) => {
    triggerHaptic(20);
    setActiveRoute(route);
    setShowMoreMenu(false);
  };

  const handleStartCall = () => {
    triggerHaptic(40);
    setActiveRoute('/call');
  };

  const isCallActive = callState !== 'idle';
  const isCallRoute = activeRoute === '/call';

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-cyber-surface/95 backdrop-blur-lg border-t border-cyber-border flex items-center justify-around px-2 z-40 safe-bottom select-none">
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeRoute === tab.route;
          return (
            <button
              key={tab.route}
              onClick={() => handleSelect(tab.route)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg relative ${isActive ? 'bg-cyan-500/10' : ''}`}>
                <Icon className="w-5 h-5" />
                {(tab as any).isCctv && cctvRecording && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-wider mt-0.5">{tab.label}</span>
            </button>
          );
        })}

        {/* Video Call Button */}
        <button
          onClick={handleStartCall}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            isCallRoute ? 'text-emerald-400 font-bold' : isCallActive ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
          title={isCallActive ? 'Call Active' : 'Start Video Call'}
        >
          <div className={`p-1 rounded-lg relative ${isCallRoute || isCallActive ? 'bg-emerald-500/20' : ''}`}>
            <PhoneCall className="w-5 h-5" />
            {isCallActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-wider mt-0.5">CALL</span>
        </button>

        {/* More Button */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            showMoreMenu ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-lg ${showMoreMenu ? 'bg-cyan-500/10' : ''}`}>
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wider mt-0.5">MORE</span>
        </button>
      </nav>

      {/* Mobile More Sheet Modal */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="w-full max-w-md bg-cyber-surface border-t sm:border border-cyber-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl safe-bottom animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-semibold tracking-wide uppercase text-slate-200">
                Navigation & Modules
              </span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreItems.map(item => {
                const Icon = item.icon;
                const isActive = activeRoute === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => handleSelect(item.route)}
                    className={`flex items-center space-x-3 p-3 rounded-xl border text-xs text-left transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Android APK Download Card (Web-only) */}
            {!isApk && (
              <div className="pt-2 border-t border-slate-800">
                <a
                  href="/SmartRemote.apk"
                  download="SmartRemote.apk"
                  onClick={() => setShowMoreMenu(false)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/40 transition-all shadow-md active:scale-98"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>Android App (.apk)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">NEW</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Download native mobile APK</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">&darr; APK</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
