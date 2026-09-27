import React, { useState } from 'react';
import {
  Terminal, Mouse, Keyboard, Monitor, Camera, Mic,
  Folder, Cpu, ChevronUp, ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useVoice } from '../../context/VoiceContext';
import { api } from '../../services/api';

export const FloatingDock: React.FC = () => {
  const { setActiveRoute, deviceMode, addNotification } = useApp();
  const { startListening } = useVoice();
  const [expanded, setExpanded] = useState<boolean>(false);

  const captureQuickScreenshot = async () => {
    try {
      addNotification('Screenshot', 'Capturing Kali Linux display...', 'info');
      const blob = await fetch('/api/remote/screenshot').then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kali-screen-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('Screenshot', 'Screenshot saved to device.', 'success');
    } catch {
      addNotification('Screenshot', 'Failed to capture screenshot', 'error');
    }
  };

  const dockActions = [
    { label: 'Terminal', icon: Terminal, action: () => setActiveRoute('/terminal') },
    { label: 'Mouse', icon: Mouse, action: () => setActiveRoute('/remote') },
    { label: 'Keyboard', icon: Keyboard, action: () => setActiveRoute('/remote') },
    { label: 'Mirror', icon: Monitor, action: () => setActiveRoute('/mirror') },
    { label: 'Screenshot', icon: Camera, action: captureQuickScreenshot },
    { label: 'Voice', icon: Mic, action: startListening },
    { label: 'Files', icon: Folder, action: () => setActiveRoute('/files') },
    { label: 'System', icon: Cpu, action: () => setActiveRoute('/system') },
  ];

  if (deviceMode === 'mobile') return null;

  return (
    <div
      className="fixed z-30 transition-all select-none bottom-6 right-6"
    >
      <div className="flex flex-col items-end space-y-2">
        {/* Expanded Mini Dock */}
        {expanded && (
          <div className="p-2 bg-cyber-surface/95 border border-cyan-500/40 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col space-y-1.5 animate-in fade-in slide-in-from-bottom-3">
            {dockActions.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    item.action();
                    setExpanded(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-cyan-300 text-xs transition-colors"
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Toggle Floating Pill */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="h-11 px-3.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-semibold rounded-full shadow-lg shadow-cyan-500/20 flex items-center space-x-1.5 transition-transform active:scale-95"
          title="Smart Control Dock"
        >
          <span className="text-xs tracking-wider uppercase font-mono">DOCK</span>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
