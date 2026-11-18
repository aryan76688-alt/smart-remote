import React, { useState } from 'react';
import { MousePointer, Video, MapPin, Bot, Sliders, Folder } from 'lucide-react';
import { DynamicIsland } from './components/DynamicIsland';
import { TouchBar } from './components/TouchBar';
import { TrackpadView } from './components/TrackpadView';
import { CctvDeckView } from './components/CctvDeckView';
import { GoogleMapView } from './components/GoogleMapView';
import { AiNexusView } from './components/AiNexusView';
import { SystemCockpitView } from './components/SystemCockpitView';
import { FileDropView } from './components/FileDropView';

type Tab = 'cctv' | 'trackpad' | 'maps' | 'ai' | 'system' | 'files';

const DOCK_TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: 'trackpad', label: 'Remote', icon: MousePointer },
  { id: 'cctv', label: 'CCTV', icon: Video },
  { id: 'maps', label: 'Radar', icon: MapPin },
  { id: 'ai', label: 'Agents', icon: Bot },
  { id: 'system', label: 'Cockpit', icon: Sliders },
  { id: 'files', label: 'Vault', icon: Folder },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cctv');

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-stitch-bg text-stitch-text font-sans">
      {/* Stitch Cosmic Aurora Canvas & Floating Ambient Light Mesh */}
      <div className="aurora-canvas" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-stitch-primaryStrong/25 rounded-full blur-[95px] animate-pulse" />
        <div className="absolute top-[42%] -left-24 w-72 h-72 bg-stitch-tertiaryStrong/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-16 -right-20 w-80 h-80 bg-stitch-secondaryStrong/15 rounded-full blur-[95px]" />
      </div>

      {/* Top Stitch Dynamic Island Telemetry Pill */}
      <DynamicIsland />

      {/* Transparent OLED Touch Bar */}
      <TouchBar />

      {/* Main Spatial Viewport */}
      <main className="relative z-10 flex-1 overflow-hidden pb-20 pt-1">
        {activeTab === 'trackpad' && <TrackpadView />}
        {activeTab === 'cctv' && <CctvDeckView />}
        {activeTab === 'maps' && <GoogleMapView />}
        {activeTab === 'ai' && <AiNexusView />}
        {activeTab === 'system' && <SystemCockpitView />}
        {activeTab === 'files' && <FileDropView />}
      </main>

      {/* Floating Stitch Liquid-Glass Bottom Dock */}
      <nav aria-label="Primary Navigation" className="fixed bottom-3 inset-x-3 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto liquid-pill rounded-full p-1.5 flex items-center justify-between gap-1 w-full max-w-md">
          {DOCK_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex-1 min-h-[46px] py-1.5 px-1 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-stitch-primaryStrong text-white shadow-[0_0_18px_rgba(62,144,255,0.75)]'
                    : 'text-stitch-muted hover:text-white'
                }`}
              >
                <Icon size={18} className={id === 'ai' && !isActive ? 'text-stitch-tertiary' : ''} />
                {id === 'cctv' && !isActive && (
                  <span className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full bg-stitch-secondary shadow-[0_0_6px_#47e266]" />
                )}
                <span className="text-[9px] font-semibold tracking-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default App;
