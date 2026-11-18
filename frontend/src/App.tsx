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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-apple-parchment text-apple-ink font-sans">
      {/* Row 1: Apple Global Nav (44px, pure #000000 per design.md) */}
      <div className="h-[44px] w-full bg-apple-black text-white px-4 flex items-center justify-between shrink-0 z-50">
        <div className="max-w-[980px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm leading-none">🍐</span>
            <span className="type-fine text-white/95 tracking-tight">pearOS</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {DOCK_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`type-fine transition-opacity ${
                  activeTab === id ? 'text-white opacity-100' : 'text-apple-mutedDark opacity-80 hover:opacity-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-onDark" />
            <span className="type-fine text-apple-mutedDark font-mono">Nexus Live</span>
          </div>
        </div>
      </div>

      {/* Row 2: Frosted Liquid Glass Sub-Nav (52px, design.md sub-nav-frosted) */}
      <DynamicIsland activeTabLabel={DOCK_TABS.find((t) => t.id === activeTab)?.label || 'CCTV'} />

      {/* Pearl Utility Strip */}
      <TouchBar />

      {/* Main Museum-Gallery Workspace */}
      <main className="flex-1 overflow-hidden pb-[84px]">
        {activeTab === 'trackpad' && <TrackpadView />}
        {activeTab === 'cctv' && <CctvDeckView />}
        {activeTab === 'maps' && <GoogleMapView />}
        {activeTab === 'ai' && <AiNexusView />}
        {activeTab === 'system' && <SystemCockpitView />}
        {activeTab === 'files' && <FileDropView />}
      </main>

      {/* Floating Liquid Glass Sticky Bar (64px, design.md floating-sticky-bar) */}
      <nav aria-label="Primary Navigation" className="fixed bottom-3 inset-x-3 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto apple-glass-floating rounded-full h-[60px] px-2 flex items-center justify-between gap-1 w-full max-w-[560px]">
          {DOCK_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 min-h-[44px] py-1.5 px-2 rounded-full flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 ${
                  isActive
                    ? 'bg-apple-primary text-white'
                    : 'text-apple-ink80 hover:text-apple-ink'
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
