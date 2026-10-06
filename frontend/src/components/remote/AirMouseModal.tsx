import React, { useState, useEffect, useRef } from 'react';
import { Compass, X, Play, Square, MousePointer, RotateCcw } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';

interface AirMouseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AirMouseModal: React.FC<AirMouseModalProps> = ({ isOpen, onClose }) => {
  const { sendInput } = useWebSocket();
  const { triggerHaptic } = useApp();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.8);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);

  const lastAngles = useRef<{ gamma: number; beta: number } | null>(null);

  const requestOrientationPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setPermissionGranted(true);
          setIsActive(true);
        } else {
          setPermissionGranted(false);
          alert('Device motion permission denied');
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setPermissionGranted(true);
      setIsActive(true);
    }
  };

  const handleToggle = () => {
    triggerHaptic(30);
    if (!isActive) {
      requestOrientationPermission();
    } else {
      setIsActive(false);
      lastAngles.current = null;
    }
  };

  useEffect(() => {
    if (!isActive) {
      lastAngles.current = null;
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // Roll (-90 to 90) -> maps to X
      const beta = e.beta ?? 0;   // Pitch (-180 to 180) -> maps to Y

      if (lastAngles.current === null) {
        lastAngles.current = { gamma, beta };
        return;
      }

      let dx = gamma - lastAngles.current.gamma;
      let dy = beta - lastAngles.current.beta;

      // Handle roll/pitch boundaries
      if (Math.abs(dx) > 180) dx = 0;
      if (Math.abs(dy) > 180) dy = 0;

      // Deadzone threshold to eliminate minor hand trembling
      const deadzone = 0.25;
      if (Math.abs(dx) < deadzone) dx = 0;
      if (Math.abs(dy) < deadzone) dy = 0;

      if (dx !== 0 || dy !== 0) {
        sendInput({
          type: 'move_rel',
          x: Math.round(dx * sensitivity * 8),
          y: Math.round(dy * sensitivity * 8)
        });
      }

      lastAngles.current = { gamma, beta };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isActive, sensitivity, sendInput]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-sm p-5 space-y-5 shadow-2xl safe-bottom animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">GYRO AIR MOUSE</h2>
              <p className="text-[10px] text-slate-400 font-mono">Hardware Gyroscope Motion Tracking</p>
            </div>
          </div>
          <button
            onClick={() => { setIsActive(false); onClose(); }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status & Calibration Indicator */}
        <div className="text-center py-4 bg-slate-950/70 rounded-2xl border border-slate-800/80 space-y-2">
          <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center transition-all ${
            isActive ? 'bg-cyan-500/20 text-cyan-400 ring-4 ring-cyan-500/30' : 'bg-slate-800 text-slate-500'
          }`}>
            <MousePointer className={`w-7 h-7 ${isActive ? 'animate-bounce' : ''}`} />
          </div>
          <div className="text-xs font-mono font-bold text-slate-300">
            {isActive ? 'TRACKING MOTION ACTIVE' : 'AIR MOUSE PAUSED'}
          </div>
          <p className="text-[10px] text-slate-400 px-4">
            Point your phone like a laser pointer or Wii remote to steer Kali cursor in the air.
          </p>
        </div>

        {/* Master Toggle */}
        <button
          onClick={handleToggle}
          className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all ${
            isActive
              ? 'bg-rose-600/30 text-rose-300 border border-rose-500'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 shadow-lg'
          }`}
        >
          {isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isActive ? 'FREEZE AIR MOUSE' : 'ACTIVATE AIR MOUSE'}
        </button>

        {/* Thumb Trigger Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              triggerHaptic(40);
              sendInput({ type: 'click', button: 1 });
            }}
            className="py-4 rounded-2xl bg-slate-800 active:bg-cyan-600 active:text-white border border-slate-700 text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
          >
            <span>LEFT CLICK</span>
            <span className="text-[9px] text-slate-400 font-mono font-normal">Primary (LMB)</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(40);
              sendInput({ type: 'click', button: 3 });
            }}
            className="py-4 rounded-2xl bg-slate-800 active:bg-cyan-600 active:text-white border border-slate-700 text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
          >
            <span>RIGHT CLICK</span>
            <span className="text-[9px] text-slate-400 font-mono font-normal">Context (RMB)</span>
          </button>
        </div>

        {/* Sensitivity & Reset */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Sensitivity</span>
            <span>{sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={sensitivity}
            onChange={e => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          <button
            onClick={() => {
              triggerHaptic(20);
              lastAngles.current = null;
            }}
            className="w-full py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Recalibrate Neutral Angle
          </button>
        </div>
      </div>
    </div>
  );
};
