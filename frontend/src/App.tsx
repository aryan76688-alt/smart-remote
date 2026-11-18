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
  { id: 'maps', label: 'Map', icon: MapPin },
  { id: 'ai', label: 'Agents', icon: Bot },
  { id: 'system', label: 'Cockpit', icon: Sliders },
  { id: 'files', label: 'Files', icon: Folder },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('cctv');

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden text-apple-ink font-sans">
      {/* Apple Daylight Liquid Glass Wallpaper + Drifting Refractive Light Orbs */}
      <div className="liquid-wallpaper" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="liquid-orb-a absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-sky-300/50 blur-[90px]" />
        <div className="liquid-orb-b absolute top-[32%] -right-24 w-[400px] h-[400px] rounded-full bg-indigo-300/45 blur-[95px]" />
        <div className="liquid-orb-a absolute -bottom-24 left-[22%] w-[420px] h-[420px] rounded-full bg-cyan-200/55 blur-[95px]" />
      </div>

      {/* Row 1: Smoked Liquid Glass Global Nav (44px) */}
      <div className="relative h-[44px] w-full apple-glass-topbar text-white px-4 flex items-center justify-between shrink-0 z-50">
        <div className="max-w-[980px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm leading-none">🍐</span>
            <span className="type-fine text-white/95 tracking-tight font-semibold">pearOS</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {DOCK_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`type-fine transition-opacity ${
                  activeTab === id ? 'text-white opacity-100 font-semibold' : 'text-white/75 hover:opacity-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-onDark animate-pulse" />
            <span className="type-fine text-white/85 font-mono">Nexus Glass</span>
          </div>
        </div>
      </div>

      {/* Row 2: Translucent Liquid Glass Sub-Nav (52px) */}
      <DynamicIsland activeTabLabel={DOCK_TABS.find((t) => t.id === activeTab)?.label || 'CCTV'} />

      {/* Translucent Pearl Glass Utility Strip */}
      <div className="relative z-20">
        <TouchBar />
      </div>

      {/* Main Spatial Glass Workspace (scrolls underneath floating liquid glass dock!) */}
      <main className="relative z-10 flex-1 overflow-hidden">
        {activeTab === 'trackpad' && <TrackpadView />}
        {activeTab === 'cctv' && <CctvDeckView />}
        {activeTab === 'maps' && <GoogleMapView />}
        {activeTab === 'ai' && <AiNexusView />}
        {activeTab === 'system' && <SystemCockpitView />}
        {activeTab === 'files' && <FileDropView />}
      </main>

      {/* Floating Ultra-Transparent Liquid Glass Dock */}
      <nav aria-label="Primary Navigation" className="fixed bottom-3.5 inset-x-3 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto apple-glass-floating rounded-full h-[62px] px-2 flex items-center justify-between gap-1 w-full max-w-[560px]">
          {DOCK_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 min-h-[46px] py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                  isActive
                    ? 'apple-btn-primary text-white'
                    : 'text-apple-ink hover:bg-white/40'
                }`}
              >
                <Icon size={17} />
                <span className="type-micro font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default App;
