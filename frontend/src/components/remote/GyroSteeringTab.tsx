import React, { useState, useEffect, useRef } from 'react';
import { Gauge, RotateCcw, Zap, Flame, Shield, HelpCircle } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';

export const GyroSteeringTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const { triggerHaptic } = useApp();

  const [tiltAngle, setTiltAngle] = useState<number>(0);
  const [zeroOffset, setZeroOffset] = useState<number>(0);
  const [sensitivity, setSensitivity] = useState<'low' | 'med' | 'high'>('med');
  const [keyMode, setKeyMode] = useState<'wasd' | 'arrows'>('wasd');
  const [activeSteerKey, setActiveSteerKey] = useState<string | null>(null);
  const [isGasPressed, setIsGasPressed] = useState<boolean>(false);
  const [isBrakePressed, setIsBrakePressed] = useState<boolean>(false);
  const [isNitroPressed, setIsNitroPressed] = useState<boolean>(false);
  const [sensorPermission, setSensorPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  const activeSteerKeyRef = useRef<string | null>(null);
  activeSteerKeyRef.current = activeSteerKey;

  // Thresholds based on sensitivity
  const threshold = sensitivity === 'low' ? 18 : sensitivity === 'med' ? 12 : 7;
  const leftKey = keyMode === 'wasd' ? 'a' : 'Left';
  const rightKey = keyMode === 'wasd' ? 'd' : 'Right';
  const gasKey = keyMode === 'wasd' ? 'w' : 'Up';
  const brakeKey = keyMode === 'wasd' ? 's' : 'Down';
  const nitroKey = 'space';

  // Request & listen to DeviceOrientation events
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // In landscape or portrait, gamma usually represents roll (steering left/right)
      const raw = e.gamma !== null ? e.gamma : 0;
      const angle = Math.max(-60, Math.min(60, raw - zeroOffset));
      setTiltAngle(angle);

      let targetKey: string | null = null;
      if (angle < -threshold) {
        targetKey = leftKey;
      } else if (angle > threshold) {
        targetKey = rightKey;
      }

      if (targetKey !== activeSteerKeyRef.current) {
        // Release previous key
        if (activeSteerKeyRef.current) {
          sendInput({ type: 'keyup', key: activeSteerKeyRef.current });
        }
        // Press new key
        if (targetKey) {
          triggerHaptic(15);
          sendInput({ type: 'keydown', key: targetKey });
        }
        setActiveSteerKey(targetKey);
      }
    };

    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((resp: string) => {
          if (resp === 'granted') {
            setSensorPermission('granted');
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setSensorPermission('denied');
          }
        })
        .catch(() => setSensorPermission('prompt'));
    } else {
      setSensorPermission('granted');
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (activeSteerKeyRef.current) {
        sendInput({ type: 'keyup', key: activeSteerKeyRef.current });
      }
    };
  }, [zeroOffset, threshold, leftKey, rightKey]);

  const calibrateCenter = () => {
    triggerHaptic(50);
    setZeroOffset(tiltAngle + zeroOffset);
  };

  // Pedal touch handlers (support touch and mouse)
  const handlePedalStart = (key: string, setter: (v: boolean) => void) => {
    triggerHaptic(30);
    setter(true);
    sendInput({ type: 'keydown', key });
  };

  const handlePedalEnd = (key: string, setter: (v: boolean) => void) => {
    setter(false);
    sendInput({ type: 'keyup', key });
  };

  return (
    <div className="h-full flex flex-col justify-between p-3 select-none text-slate-100 font-sans">
      {/* Top HUD Controls */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-cyan-500/30 p-2.5 rounded-2xl shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>GYRO RACING WHEEL</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                {Math.round(tiltAngle)}°
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Steer: {activeSteerKey ? activeSteerKey.toUpperCase() : 'CENTER'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Key Mode */}
          <button
            onClick={() => setKeyMode(k => k === 'wasd' ? 'arrows' : 'wasd')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 active:scale-95 transition-all"
          >
            {keyMode.toUpperCase()}
          </button>

          {/* Calibrate Zero */}
          <button
            onClick={calibrateCenter}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold font-mono flex items-center space-x-1 active:scale-95 transition-all"
            title="Calibrate Center Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>CALIBRATE</span>
          </button>
        </div>
      </div>

      {/* Center Interactive Steering Wheel Graphic */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
        {/* Outer Wheel Frame */}
        <div
          style={{ transform: `rotate(${tiltAngle * 1.6}deg)` }}
          className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full border-8 border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl flex items-center justify-center transition-transform duration-75 ease-out"
        >
          {/* Neon Ring */}
          <div className="absolute inset-1 rounded-full border border-cyan-500/30" />

          {/* Steering Spokes */}
          <div className="absolute w-full h-3 bg-slate-800" />
          <div className="absolute w-3 h-full bg-slate-800" />

          {/* Center Hub */}
          <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border-4 border-slate-900 shadow-xl flex flex-col items-center justify-center text-white font-mono">
            <span className="text-[10px] font-bold tracking-widest text-cyan-200">KALI</span>
            <span className="text-xs font-black">{Math.abs(Math.round(tiltAngle))}°</span>
          </div>

          {/* Left/Right Grip Indicators */}
          <div className={`absolute left-2 w-4 h-12 rounded-full transition-all ${tiltAngle < -threshold ? 'bg-cyan-400 shadow-lg shadow-cyan-500/50' : 'bg-slate-700'}`} />
          <div className={`absolute right-2 w-4 h-12 rounded-full transition-all ${tiltAngle > threshold ? 'bg-cyan-400 shadow-lg shadow-cyan-500/50' : 'bg-slate-700'}`} />
        </div>

        {/* Steering Indicator Bar */}
        <div className="w-48 h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden relative">
          <div
            style={{
              left: `${50 + (tiltAngle / 60) * 50}%`,
              transform: 'translateX(-50%)'
            }}
            className="absolute top-0 bottom-0 w-6 bg-cyan-400 rounded-full transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Bottom Racing Pedals Arena */}
      <div className="grid grid-cols-3 gap-3">
        {/* BRAKE PEDAL */}
        <button
          onMouseDown={() => handlePedalStart(brakeKey, setIsBrakePressed)}
          onMouseUp={() => handlePedalEnd(brakeKey, setIsBrakePressed)}
          onTouchStart={() => handlePedalStart(brakeKey, setIsBrakePressed)}
          onTouchEnd={() => handlePedalEnd(brakeKey, setIsBrakePressed)}
          className={`h-24 rounded-2xl flex flex-col items-center justify-center border transition-all active:scale-95 shadow-xl ${
            isBrakePressed
              ? 'bg-rose-600 border-rose-400 text-white shadow-rose-600/40'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/50'
          }`}
        >
          <span className="text-base font-black tracking-wider">BRAKE</span>
          <span className="text-[10px] font-mono text-rose-300/80 mt-1">({brakeKey.toUpperCase()})</span>
        </button>

        {/* NITRO / BOOST */}
        <button
          onMouseDown={() => handlePedalStart(nitroKey, setIsNitroPressed)}
          onMouseUp={() => handlePedalEnd(nitroKey, setIsNitroPressed)}
          onTouchStart={() => handlePedalStart(nitroKey, setIsNitroPressed)}
          onTouchEnd={() => handlePedalEnd(nitroKey, setIsNitroPressed)}
          className={`h-24 rounded-2xl flex flex-col items-center justify-center border transition-all active:scale-95 shadow-xl ${
            isNitroPressed
              ? 'bg-purple-600 border-purple-400 text-white shadow-purple-600/40'
              : 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/50'
          }`}
        >
          <Flame className="w-5 h-5 mb-0.5 animate-pulse" />
          <span className="text-xs font-black tracking-wider">NITRO</span>
          <span className="text-[10px] font-mono text-purple-300/80">SPACE</span>
        </button>

        {/* GAS ACCELERATOR */}
        <button
          onMouseDown={() => handlePedalStart(gasKey, setIsGasPressed)}
          onMouseUp={() => handlePedalEnd(gasKey, setIsGasPressed)}
          onTouchStart={() => handlePedalStart(gasKey, setIsGasPressed)}
          onTouchEnd={() => handlePedalEnd(gasKey, setIsGasPressed)}
          className={`h-24 rounded-2xl flex flex-col items-center justify-center border transition-all active:scale-95 shadow-xl ${
            isGasPressed
              ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-emerald-500/50 font-black'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
          }`}
        >
          <span className="text-base font-black tracking-wider">GAS</span>
          <span className="text-[10px] font-mono text-emerald-300/80 mt-1">({gasKey.toUpperCase()})</span>
        </button>
      </div>
    </div>
  );
};
