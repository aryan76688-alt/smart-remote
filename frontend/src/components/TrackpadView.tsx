import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Compass, Keyboard, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';
import { api } from '../services/api';

export const TrackpadView: React.FC = () => {
  const [gyroActive, setGyroActive] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [inputText, setInputText] = useState('');
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

  // Handle Touch Move
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!lastTouchRef.current) return;
    const touch = e.touches[0];
    const dx = (touch.clientX - lastTouchRef.current.x) * 1.6;
    const dy = (touch.clientY - lastTouchRef.current.y) * 1.6;

    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    api.moveCursor(dx, dy);
  };

  const handleTouchEnd = () => {
    lastTouchRef.current = null;
  };

  // Gyroscope Air Mouse
  useEffect(() => {
    if (!gyroActive) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        api.sendGyro(e.alpha, e.beta, e.gamma);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [gyroActive]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText) {
      await api.typeText(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Top Remote Control Strip */}
      <div className="flex items-center justify-between glass-panel p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGyroActive(!gyroActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              gyroActive ? 'bg-apple-blue text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
          >
            <Compass size={14} className={gyroActive ? 'animate-spin' : ''} />
            <span>{gyroActive ? 'Gyro Active' : 'Air Mouse'}</span>
          </button>
          <button
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showKeyboard ? 'bg-apple-purple text-white shadow-md' : 'bg-slate-200/60 text-slate-700'
            }`}
          >
            <Keyboard size={14} />
            <span>Type Text</span>
          </button>
        </div>

        {/* Quick Nav Keys */}
        <div className="flex items-center gap-1">
          <button onClick={() => api.sendShortcut('Up')} className="p-2 bg-slate-200/50 rounded-lg active:scale-95 text-slate-700">
            <ArrowUp size={14} />
          </button>
          <button onClick={() => api.sendShortcut('Down')} className="p-2 bg-slate-200/50 rounded-lg active:scale-95 text-slate-700">
            <ArrowDown size={14} />
          </button>
          <button onClick={() => api.sendShortcut('Left')} className="p-2 bg-slate-200/50 rounded-lg active:scale-95 text-slate-700">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => api.sendShortcut('Right')} className="p-2 bg-slate-200/50 rounded-lg active:scale-95 text-slate-700">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Optional Keyboard Input Drawer */}
      {showKeyboard && (
        <form onSubmit={handleSendText} className="glass-panel p-3 rounded-2xl flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type text to send to pearOS cursor..."
            className="flex-1 bg-white/70 px-3 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-apple-blue"
            autoFocus
          />
          <button type="submit" className="px-4 py-2 bg-apple-blue text-white rounded-xl text-sm font-semibold flex items-center gap-1">
            <span>Send</span>
            <CornerDownLeft size={14} />
          </button>
        </form>
      )}

      {/* Main Glass Trackpad Area */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => api.clickMouse(1)}
        className="flex-1 glass-panel rounded-3xl flex flex-col items-center justify-center relative shadow-inner border border-white/60 cursor-crosshair active:bg-white/90 transition-all select-none"
      >
        <div className="flex flex-col items-center pointer-events-none opacity-40">
          <MousePointer size={36} className="text-slate-500 mb-2" />
          <span className="text-xs uppercase font-bold tracking-widest text-slate-500">Fluid Haptic Trackpad</span>
          <span className="text-[11px] text-slate-400 mt-1">Tap to Click • 2-Finger Scroll • Drag to Move</span>
        </div>

        {/* Side Scroll Strip */}
        <div
          onTouchMove={(e) => {
            e.stopPropagation();
            api.scrollMouse(e.touches[0].clientY > 200 ? 5 : -5);
          }}
          className="absolute right-2 top-4 bottom-4 w-6 bg-slate-200/40 rounded-full flex flex-col items-center justify-between py-2 text-slate-400"
        >
          <ArrowUp size={12} />
          <span className="text-[9px] font-bold rotate-90">SCROLL</span>
          <ArrowDown size={12} />
        </div>
      </div>

      {/* Primary Click Buttons */}
      <div className="grid grid-cols-2 gap-3 h-16">
        <button
          onClick={() => api.clickMouse(1)}
          className="glass-panel rounded-2xl flex items-center justify-center font-semibold text-slate-700 active:scale-95 active:bg-apple-blue active:text-white transition-all shadow-sm"
        >
          Left Click
        </button>
        <button
          onClick={() => api.clickMouse(3)}
          className="glass-panel rounded-2xl flex items-center justify-center font-semibold text-slate-700 active:scale-95 active:bg-slate-700 active:text-white transition-all shadow-sm"
        >
          Right Click
        </button>
      </div>
    </div>
  );
};
