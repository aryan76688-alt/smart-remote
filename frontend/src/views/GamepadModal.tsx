import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Gamepad2, Compass, Sparkles } from 'lucide-react';

interface GamepadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GamepadModal: React.FC<GamepadModalProps> = ({ isOpen, onClose }) => {
  const [gyroEnabled, setGyroEnabled] = useState(false);

  useEffect(() => {
    if (!gyroEnabled || !isOpen) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gx = (e.gamma || 0) / 45.0; // roll
      const gy = (e.beta || 0) / 45.0;  // pitch
      api.sendProGamepadEvent({ gyro_x: gx, gyro_y: gy }).catch(() => null);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [gyroEnabled, isOpen]);

  if (!isOpen) return null;

  const triggerButton = (btn: string, isPressed: boolean) => {
    if (isPressed && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
    api.sendProGamepadEvent({ button: btn, is_pressed: isPressed }).catch(() => null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-fadeIn">
      {/* Top Bar */}
      <div className="flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <Gamepad2 size={20} className="text-blue-400" />
          <span className="font-bold text-sm tracking-tight">pearOS Pro Gamepad</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setGyroEnabled(!gyroEnabled)}
            className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              gyroEnabled ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            <Compass size={14} className={gyroEnabled ? 'animate-spin' : ''} />
            <span>Gyro Aim {gyroEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Shoulders */}
      <div className="flex justify-between px-6">
        <button
          onPointerDown={() => triggerButton('L1', true)}
          onPointerUp={() => triggerButton('L1', false)}
          className="w-20 h-10 rounded-2xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs shadow-md border border-white/10"
        >
          L1
        </button>
        <button
          onPointerDown={() => triggerButton('R1', true)}
          onPointerUp={() => triggerButton('R1', false)}
          className="w-20 h-10 rounded-2xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs shadow-md border border-white/10"
        >
          R1
        </button>
      </div>

      {/* Main Controls: D-Pad on Left, ABXY on Right */}
      <div className="flex justify-between items-center px-4 my-auto">
        {/* D-Pad */}
        <div className="w-36 h-36 relative bg-neutral-900 rounded-full p-2 border border-white/10 flex items-center justify-center shadow-lg">
          <button
            onPointerDown={() => triggerButton('UP', true)}
            onPointerUp={() => triggerButton('UP', false)}
            className="absolute top-1 w-10 h-10 rounded-xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs"
          >
            ▲
          </button>
          <button
            onPointerDown={() => triggerButton('DOWN', true)}
            onPointerUp={() => triggerButton('DOWN', false)}
            className="absolute bottom-1 w-10 h-10 rounded-xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs"
          >
            ▼
          </button>
          <button
            onPointerDown={() => triggerButton('LEFT', true)}
            onPointerUp={() => triggerButton('LEFT', false)}
            className="absolute left-1 w-10 h-10 rounded-xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs"
          >
            ◀
          </button>
          <button
            onPointerDown={() => triggerButton('RIGHT', true)}
            onPointerUp={() => triggerButton('RIGHT', false)}
            className="absolute right-1 w-10 h-10 rounded-xl bg-neutral-800 active:bg-neutral-700 text-white font-bold text-xs"
          >
            ▶
          </button>
          <div className="w-6 h-6 rounded-full bg-neutral-950" />
        </div>

        {/* Center Start/Select */}
        <div className="flex gap-2">
          <button
            onPointerDown={() => triggerButton('SELECT', true)}
            onPointerUp={() => triggerButton('SELECT', false)}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-[10px] text-neutral-400 font-mono"
          >
            SELECT
          </button>
          <button
            onPointerDown={() => triggerButton('START', true)}
            onPointerUp={() => triggerButton('START', false)}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-[10px] text-neutral-400 font-mono"
          >
            START
          </button>
        </div>

        {/* ABXY Diamond */}
        <div className="w-36 h-36 relative bg-neutral-900 rounded-full p-2 border border-white/10 flex items-center justify-center shadow-lg">
          <button
            onPointerDown={() => triggerButton('Y', true)}
            onPointerUp={() => triggerButton('Y', false)}
            className="absolute top-1 w-10 h-10 rounded-full bg-amber-500/20 active:bg-amber-500 text-amber-400 active:text-white font-bold text-sm border border-amber-500/40"
          >
            Y
          </button>
          <button
            onPointerDown={() => triggerButton('A', true)}
            onPointerUp={() => triggerButton('A', false)}
            className="absolute bottom-1 w-10 h-10 rounded-full bg-emerald-500/20 active:bg-emerald-500 text-emerald-400 active:text-white font-bold text-sm border border-emerald-500/40"
          >
            A
          </button>
          <button
            onPointerDown={() => triggerButton('X', true)}
            onPointerUp={() => triggerButton('X', false)}
            className="absolute left-1 w-10 h-10 rounded-full bg-blue-500/20 active:bg-blue-500 text-blue-400 active:text-white font-bold text-sm border border-blue-500/40"
          >
            X
          </button>
          <button
            onPointerDown={() => triggerButton('B', true)}
            onPointerUp={() => triggerButton('B', false)}
            className="absolute right-1 w-10 h-10 rounded-full bg-red-500/20 active:bg-red-500 text-red-400 active:text-white font-bold text-sm border border-red-500/40"
          >
            B
          </button>
          <div className="w-6 h-6 rounded-full bg-neutral-950" />
        </div>
      </div>

      <div className="text-center text-[11px] text-neutral-500">
        Low-Latency X11 Input Engine • Hardware Acceleration
      </div>
    </div>
  );
};
