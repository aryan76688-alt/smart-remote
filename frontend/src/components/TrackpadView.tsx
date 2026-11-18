import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Compass, Keyboard, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';
import { api } from '../services/api';

export const TrackpadView: React.FC = () => {
  const [gyroActive, setGyroActive] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [inputText, setInputText] = useState('');
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!lastTouchRef.current) return;
    const touch = e.touches[0];
    const dx = (touch.clientX - lastTouchRef.current.x) * 1.65;
    const dy = (touch.clientY - lastTouchRef.current.y) * 1.65;
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    api.moveCursor(dx, dy);
  };

  const handleTouchEnd = () => {
    lastTouchRef.current = null;
  };

  useEffect(() => {
    if (!gyroActive) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        api.sendGyro(e.alpha, e.beta, e.gamma);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [gyroActive]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText) {
      await api.typeText(inputText);
      setInputText('');
    }
  };

  return (
    <div className="w-full h-full px-3 pb-4 flex flex-col items-center">
      <div className="w-full max-w-md h-full flex flex-col gap-3">
        {/* Control Pill Bar */}
        <div className="liquid-glass rounded-2xl p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGyroActive(!gyroActive)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                gyroActive
                  ? 'bg-stitch-primaryStrong/35 border-stitch-primary/60 text-stitch-primary shadow-[0_0_16px_rgba(62,144,255,0.4)]'
                  : 'liquid-btn text-stitch-text'
              }`}
            >
              <Compass size={14} className={gyroActive ? 'animate-spin' : ''} />
              <span>{gyroActive ? 'Gyro Live' : 'Air Mouse'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowKeyboard(!showKeyboard)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                showKeyboard
                  ? 'bg-stitch-tertiaryStrong/35 border-stitch-tertiary/60 text-stitch-tertiary shadow-[0_0_16px_rgba(200,99,251,0.4)]'
                  : 'liquid-btn text-stitch-text'
              }`}
            >
              <Keyboard size={14} />
              <span>Type</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {[
              { key: 'Up', icon: ArrowUp },
              { key: 'Down', icon: ArrowDown },
              { key: 'Left', icon: ChevronLeft },
              { key: 'Right', icon: ChevronRight },
            ].map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-label={`Arrow ${key}`}
                onClick={() => api.sendShortcut(key)}
                className="w-9 h-9 liquid-btn rounded-xl flex items-center justify-center text-stitch-muted hover:text-white"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard Drawer */}
        {showKeyboard && (
          <form onSubmit={handleSendText} className="liquid-glass rounded-2xl p-2.5 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send text to pearOS cursor..."
              className="flex-1 liquid-glass-deep px-3 py-2 rounded-xl text-xs text-stitch-text placeholder:text-stitch-outline focus:outline-none focus:border-stitch-primary/60"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-stitch-primaryStrong/80 hover:bg-stitch-primaryStrong text-white text-xs font-semibold flex items-center gap-1 shadow-[0_0_15px_rgba(62,144,255,0.4)]"
            >
              <span>Send</span>
              <CornerDownLeft size={13} />
            </button>
          </form>
        )}

        {/* Transparent Crystal Trackpad Surface */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => api.clickMouse(1)}
          className="flex-1 liquid-glass rounded-3xl relative flex flex-col items-center justify-center cursor-crosshair active:bg-white/15 transition-colors overflow-hidden"
        >
          <div className="pointer-events-none flex flex-col items-center gap-2 opacity-60">
            <div className="w-14 h-14 rounded-full liquid-glass-deep flex items-center justify-center text-stitch-primary">
              <MousePointer size={24} />
            </div>
            <span className="font-display text-xs uppercase tracking-[0.2em] text-stitch-text font-semibold">
              Liquid Glass Trackpad
            </span>
            <span className="font-mono text-[10px] text-stitch-muted">
              Drag to Steer • Tap to Click
            </span>
          </div>

          {/* Transparent Vertical Scroll Strip */}
          <div
            onTouchMove={(e) => {
              e.stopPropagation();
              api.scrollMouse(e.touches[0].clientY > 260 ? 5 : -5);
            }}
            className="absolute right-2.5 top-5 bottom-5 w-7 liquid-glass-deep rounded-full flex flex-col items-center justify-between py-3 text-stitch-outline"
          >
            <ArrowUp size={12} />
            <span className="font-mono text-[8px] tracking-widest rotate-90 text-stitch-primary">SCROLL</span>
            <ArrowDown size={12} />
          </div>
        </div>

        {/* Tactile Transparent Click Buttons */}
        <div className="grid grid-cols-2 gap-3 h-14">
          <button
            type="button"
            onClick={() => api.clickMouse(1)}
            className="liquid-glass rounded-2xl flex items-center justify-center font-display text-xs font-bold tracking-wide text-stitch-text active:bg-stitch-primaryStrong/40 active:scale-[0.97] transition-all"
          >
            Left Click
          </button>
          <button
            type="button"
            onClick={() => api.clickMouse(3)}
            className="liquid-glass rounded-2xl flex items-center justify-center font-display text-xs font-bold tracking-wide text-stitch-text active:bg-stitch-tertiaryStrong/40 active:scale-[0.97] transition-all"
          >
            Right Click
          </button>
        </div>
      </div>
    </div>
  );
};
