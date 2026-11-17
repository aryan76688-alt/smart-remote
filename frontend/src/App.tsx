import React, { useState } from 'react';
import { MousePointer, Video, MapPin, Bot, Activity, Folder } from 'lucide-react';
import { DynamicIsland } from './components/DynamicIsland';
import { TouchBar } from './components/TouchBar';
import { TrackpadView } from './components/TrackpadView';
import { CctvDeckView } from './components/CctvDeckView';
import { GoogleMapView } from './components/GoogleMapView';
import { AiNexusView } from './components/AiNexusView';
import { SystemCockpitView } from './components/SystemCockpitView';
import { FileDropView } from './components/FileDropView';

type Tab = 'trackpad' | 'cctv' | 'maps' | 'ai' | 'system' | 'files';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('trackpad');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-b from-[#F2F2F7] via-[#E5E5EA] to-[#D1D1D6] font-sans">
      {/* Top Floating Dynamic Island */}
      <DynamicIsland />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col pt-14 pb-20 overflow-hidden">
        {/* Context-Adaptive OLED Touch Bar */}
        <TouchBar />

        {/* Viewport Router */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'trackpad' && <TrackpadView />}
          {activeTab === 'cctv' && <CctvDeckView />}
          {activeTab === 'maps' && <GoogleMapView />}
          {activeTab === 'ai' && <AiNexusView />}
          {activeTab === 'system' && <SystemCockpitView />}
          {activeTab === 'files' && <FileDropView />}
        </div>
      </div>

      {/* Bottom Floating Glass Navigation Dock */}
      <div className="fixed bottom-3 inset-x-4 z-30">
        <div className="glass-panel rounded-3xl p-1.5 flex items-center justify-around shadow-xl border border-white/80">
          <button
            onClick={() => setActiveTab('trackpad')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'trackpad' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MousePointer size={18} />
            <span className="text-[10px] font-bold mt-0.5">Remote</span>
          </button>

          <button
            onClick={() => setActiveTab('cctv')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'cctv' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Video size={18} />
            <span className="text-[10px] font-bold mt-0.5">CCTV</span>
          </button>

          <button
            onClick={() => setActiveTab('maps')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'maps' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <MapPin size={18} />
            <span className="text-[10px] font-bold mt-0.5">Map</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'ai' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Bot size={18} />
            <span className="text-[10px] font-bold mt-0.5">AI Agents</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'system' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity size={18} />
            <span className="text-[10px] font-bold mt-0.5">Cockpit</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all ${
              activeTab === 'files' ? 'bg-apple-blue text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Folder size={18} />
            <span className="text-[10px] font-bold mt-0.5">Files</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
