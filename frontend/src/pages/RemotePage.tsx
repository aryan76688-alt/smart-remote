import React, { useState } from 'react';
import {
  Hand, Mouse, Crosshair, Keyboard, Tv, Zap, Gamepad2, Smartphone,
  Hash, Compass, QrCode, Clipboard
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TouchpadTab } from '../components/remote/TouchpadTab';
import { MouseTab } from '../components/remote/MouseTab';
import { DPadTab } from '../components/remote/DPadTab';
import { VirtualKeyboard } from '../components/remote/VirtualKeyboard';
import { MediaRemoteTab } from '../components/remote/MediaRemoteTab';
import { ShortcutsTab } from '../components/remote/ShortcutsTab';
import { GamingConsoleTab } from '../components/remote/GamingConsoleTab';
import { TacticalNumpadTab } from '../components/remote/TacticalNumpadTab';
import { AirMouseModal } from '../components/remote/AirMouseModal';
import { BarcodeScannerModal } from '../components/remote/BarcodeScannerModal';
import { ClipboardSyncModal } from '../components/common/ClipboardSyncModal';

export const RemotePage: React.FC = () => {
  const { isApk, triggerHaptic } = useApp();
  const [activeTab, setActiveTab] = useState<'console' | 'touchpad' | 'mouse' | 'dpad' | 'keyboard' | 'numpad' | 'media' | 'shortcuts'>('console');

  // Modals
  const [airMouseOpen, setAirMouseOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [clipboardOpen, setClipboardOpen] = useState(false);

  const tabs = [
    { id: 'console', label: 'Console', icon: Gamepad2 },
    { id: 'touchpad', label: 'Touchpad', icon: Hand },
    { id: 'mouse', label: 'Mouse', icon: Mouse },
    { id: 'numpad', label: 'Numpad', icon: Hash },
    { id: 'dpad', label: 'D-Pad', icon: Crosshair },
    { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
    { id: 'media', label: 'Media', icon: Tv },
    { id: 'shortcuts', label: 'Shortcuts', icon: Zap },
  ] as const;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-cyber-bg max-w-4xl mx-auto w-full select-none p-3 pb-20">
      {/* Sensor Tools Bar (Air Mouse, QR Scanner, Clipboard Sync) */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5 px-0.5">
        <button
          onClick={() => { triggerHaptic(20); setAirMouseOpen(true); }}
          className="flex-1 py-1.5 px-2 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>AIR MOUSE</span>
        </button>

        <button
          onClick={() => { triggerHaptic(20); setScannerOpen(true); }}
          className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
        >
          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
          <span>QR TYPE</span>
        </button>

        <button
          onClick={() => { triggerHaptic(20); setClipboardOpen(true); }}
          className="flex-1 py-1.5 px-2 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[11px] font-bold font-mono flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
        >
          <Clipboard className="w-3.5 h-3.5 text-purple-400" />
          <span>CLIPBOARD</span>
        </button>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center space-x-1 overflow-x-auto bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-3 shrink-0">
        {!isApk && (
          <a
            href="/SmartRemote.apk"
            download="SmartRemote.apk"
            className="min-w-[65px] py-1.5 px-2 rounded-xl flex items-center justify-center space-x-1 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400 shrink-0 shadow-sm"
            title="Download Android APK"
          >
            <Smartphone className="w-3 h-3 text-cyan-400" />
            <span>APK</span>
          </a>
        )}
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl flex items-center justify-center space-x-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600/40 to-emerald-600/30 border border-cyan-500/50 text-cyan-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab View Container */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'console' && <GamingConsoleTab />}
        {activeTab === 'touchpad' && <TouchpadTab />}
        {activeTab === 'mouse' && <MouseTab />}
        {activeTab === 'numpad' && <TacticalNumpadTab />}
        {activeTab === 'dpad' && <DPadTab />}
        {activeTab === 'keyboard' && <VirtualKeyboard />}
        {activeTab === 'media' && <MediaRemoteTab />}
        {activeTab === 'shortcuts' && <ShortcutsTab />}
      </div>

      {/* Interactive Sensor & Fusion Modals */}
      <AirMouseModal isOpen={airMouseOpen} onClose={() => setAirMouseOpen(false)} />
      <BarcodeScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} />
      <ClipboardSyncModal isOpen={clipboardOpen} onClose={() => setClipboardOpen(false)} />
    </div>
  );
};
