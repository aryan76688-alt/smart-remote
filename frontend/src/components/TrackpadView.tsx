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
    <div className="w-full h-full px-4 pb-4 flex flex-col">
      <div className="max-w-[980px] w-full mx-auto h-full flex flex-col gap-3">
        {/* Control Row */}
        <div className="apple-glass-card p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGyroActive(!gyroActive)}
              className={`min-h-[40px] px-4 py-2 type-caption flex items-center gap-1.5 ${
                gyroActive ? 'apple-btn-primary' : 'apple-option-chip'
              }`}
            >
              <Compass size={14} className={gyroActive ? 'animate-spin' : 'text-apple-primary'} />
              <span>{gyroActive ? 'Air Mouse On' : 'Air Mouse'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowKeyboard(!showKeyboard)}
              className={`min-h-[40px] px-4 py-2 type-caption flex items-center gap-1.5 ${
                showKeyboard ? 'apple-btn-primary' : 'apple-option-chip'
              }`}
            >
              <Keyboard size={14} className={showKeyboard ? '' : 'text-apple-primary'} />
              <span>Keyboard</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
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
                className="apple-btn-pearl w-10 h-10 flex items-center justify-center"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* Pill Search-Style Keyboard Drawer */}
        {showKeyboard && (
          <form onSubmit={handleSendText} className="apple-glass-card p-3 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type text to send to pearOS..."
              className="flex-1 apple-search-input px-5 type-caption"
              autoFocus
            />
            <button
              type="submit"
              className="apple-btn-primary px-5 min-h-[44px] type-caption flex items-center gap-1.5"
            >
              <span>Send</span>
              <CornerDownLeft size={14} />
            </button>
          </form>
        )}

        {/* Liquid Glass Trackpad Surface */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => api.clickMouse(1)}
          className="flex-1 apple-glass-card relative flex flex-col items-center justify-center cursor-crosshair overflow-hidden"
        >
          <div className="pointer-events-none flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-apple-parchment border border-apple-hairline flex items-center justify-center text-apple-primary">
              <MousePointer size={20} />
            </div>
            <p className="type-body-strong text-apple-ink">Trackpad</p>
            <p className="type-fine text-apple-ink48">Drag to move · Tap to click</p>
          </div>

          {/* Scroll Rail */}
          <div
            onTouchMove={(e) => {
              e.stopPropagation();
              api.scrollMouse(e.touches[0].clientY > 260 ? 5 : -5);
            }}
            className="absolute right-3 top-5 bottom-5 w-8 bg-apple-parchment border border-apple-hairline rounded-full flex flex-col items-center justify-between py-3 text-apple-ink48"
          >
            <ArrowUp size={12} />
            <span className="type-micro font-mono rotate-90 text-apple-ink80">SCROLL</span>
            <ArrowDown size={12} />
          </div>
        </div>

        {/* Left & Right Click Buttons */}
        <div className="grid grid-cols-2 gap-3 h-[52px]">
          <button
            type="button"
            onClick={() => api.clickMouse(1)}
            className="apple-btn-pearl h-full flex items-center justify-center type-caption-strong"
          >
            Left Click
          </button>
          <button
            type="button"
            onClick={() => api.clickMouse(3)}
            className="apple-btn-pearl h-full flex items-center justify-center type-caption-strong"
          >
            Right Click
          </button>
        </div>
      </div>
    </div>
  );
};
