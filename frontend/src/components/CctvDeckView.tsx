import React, { useState, useEffect } from 'react';
import { Video, Smartphone, Laptop, Flame, ShieldAlert, RefreshCw, Maximize2 } from 'lucide-react';
import { api } from '../services/api';

export const CctvDeckView: React.FC = () => {
  const [activeFeed, setActiveFeed] = useState<'laptop' | 'mobile'>('laptop');
  const [thermal, setThermal] = useState(false);
  const [tripwire, setTripwire] = useState(false);
  const [feedKey, setFeedKey] = useState(Date.now());

  // Signal Mobile CCTV activation strictly when Mobile feed is selected!
  useEffect(() => {
    if (activeFeed === 'mobile') {
      api.toggleMobileCctv(true);
    } else {
      api.toggleMobileCctv(false);
    }

    return () => {
      // Deactivate when leaving CCTV view
      api.toggleMobileCctv(false);
    };
  }, [activeFeed]);

  const handleThermalToggle = async () => {
    const next = !thermal;
    setThermal(next);
    await api.toggleThermal(next);
    setFeedKey(Date.now());
  };

  const handleTripwireToggle = async () => {
    const next = !tripwire;
    setTripwire(next);
    await api.configureTripwire(next);
  };

  const streamUrl = activeFeed === 'laptop'
    ? `${window.location.origin}/api/cctv/laptop/stream.mjpg?t=${feedKey}`
    : `${window.location.origin}/api/cctv/mobile/stream.mjpg?t=${feedKey}`;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* CCTV Navigation & Mode Bar */}
      <div className="flex items-center justify-between glass-panel p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFeed('laptop')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeFeed === 'laptop' ? 'bg-apple-blue text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
          >
            <Laptop size={14} />
            <span>Laptop Cam</span>
          </button>
          <button
            onClick={() => setActiveFeed('mobile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeFeed === 'mobile' ? 'bg-apple-purple text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
          >
            <Smartphone size={14} />
            <span>Mobile CCTV</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleThermalToggle}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
              thermal ? 'bg-apple-orange text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
            title="Ironbow Thermal Mode"
          >
            <Flame size={14} />
          </button>
          <button
            onClick={handleTripwireToggle}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
              tripwire ? 'bg-apple-red text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
            title="Laser Tripwire"
          >
            <ShieldAlert size={14} />
          </button>
          <button
            onClick={() => setFeedKey(Date.now())}
            className="p-2 bg-slate-200/60 rounded-xl text-slate-700 active:scale-95 transition-all"
            title="Refresh Feed"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main CCTV Stream Viewport */}
      <div className="flex-1 glass-dark rounded-3xl overflow-hidden relative shadow-2xl flex items-center justify-center border border-white/20">
        <img
          key={feedKey}
          src={streamUrl}
          alt="CCTV Live Feed"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Placeholder when offline
            (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect width='100%' height='100%' fill='%23111'/><text x='50%' y='50%' fill='%23888' font-family='sans-serif' font-size='16' text-anchor='middle'>pearOS CCTV Feed Offline</text></svg>";
          }}
        />

        {/* Live OSD Overlay */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-white font-mono flex items-center gap-2 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-apple-red animate-ping"></span>
          <span>{activeFeed === 'laptop' ? 'LAPTOP WEBCAM 01' : 'MOBILE PHONE CCTV 02'}</span>
          {thermal && <span className="text-apple-orange font-bold">• THERMAL</span>}
        </div>

        {/* Laser Tripwire Overlay */}
        {tripwire && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-apple-red shadow-[0_0_12px_#FF3B30] animate-pulse"></div>
            <span className="absolute bg-apple-red/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
              Laser Tripwire Active
            </span>
          </div>
        )}

        {/* Battery & Stealth Info */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/80 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
          <span>RAM Pipe: In-Memory • Zero Disk Bloat</span>
          <span className="text-apple-green font-medium">Work After Lockscreen: Enabled</span>
        </div>
      </div>
    </div>
  );
};
