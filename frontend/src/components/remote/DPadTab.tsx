import React, { useState, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Target, Zap } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

export const DPadTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const [stepSize, setStepSize] = useState<number>(25);
  const [precisionMode, setPrecisionMode] = useState<boolean>(false);
  const repeatIntervalRef = useRef<number | undefined>(undefined);

  const startMove = (direction: string) => {
    sendInput({
      type: 'dpad',
      direction,
      step: stepSize,
      precision: precisionMode
    });
    if (navigator.vibrate) navigator.vibrate(10);

    repeatIntervalRef.current = window.setInterval(() => {
      sendInput({
        type: 'dpad',
        direction,
        step: stepSize,
        precision: precisionMode
      });
    }, 120);
  };

  const stopMove = () => {
    if (repeatIntervalRef.current !== undefined) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = undefined;
    }
  };

  const handleCenterClick = () => {
    sendInput({ type: 'click', button: 1 });
    if (navigator.vibrate) navigator.vibrate(15);
  };

  return (
    <div className="flex flex-col h-full items-center justify-between py-2 select-none">
      {/* Precision / Speed Toolbar */}
      <div className="flex items-center space-x-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl text-xs w-full max-w-sm justify-between">
        <button
          onClick={() => setPrecisionMode(!precisionMode)}
          className={`px-3 py-1 rounded-xl font-medium flex items-center space-x-1.5 transition-all ${
            precisionMode
              ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Precision Mode</span>
        </button>

        <div className="flex items-center space-x-1 font-mono text-[11px] text-slate-400">
          <span>Step:</span>
          {[10, 25, 50].map(s => (
            <button
              key={s}
              onClick={() => setStepSize(s)}
              className={`px-2 py-0.5 rounded ${
                stepSize === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Circular D-Pad Controller */}
      <div className="relative w-72 h-72 rounded-full bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-slate-800 shadow-2xl p-4 flex items-center justify-center">
        {/* Diagonals */}
        <button
          onPointerDown={() => startMove('up-left')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute top-7 left-7 w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-500 text-[10px] font-bold flex items-center justify-center transition-transform active:scale-95"
        >
          ↖
        </button>
        <button
          onPointerDown={() => startMove('up-right')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute top-7 right-7 w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-500 text-[10px] font-bold flex items-center justify-center transition-transform active:scale-95"
        >
          ↗
        </button>
        <button
          onPointerDown={() => startMove('down-left')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute bottom-7 left-7 w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-500 text-[10px] font-bold flex items-center justify-center transition-transform active:scale-95"
        >
          ↙
        </button>
        <button
          onPointerDown={() => startMove('down-right')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute bottom-7 right-7 w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-500 text-[10px] font-bold flex items-center justify-center transition-transform active:scale-95"
        >
          ↘
        </button>

        {/* 4 Cardinal Direction Buttons */}
        {/* UP */}
        <button
          onPointerDown={() => startMove('up')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute top-2 w-16 h-20 rounded-t-2xl bg-gradient-to-b from-slate-800 to-slate-850 hover:bg-slate-700 active:from-cyan-500 active:to-cyan-600 active:text-slate-950 flex items-center justify-center text-slate-200 shadow-md transition-all active:scale-95"
        >
          <ArrowUp className="w-6 h-6" />
        </button>

        {/* DOWN */}
        <button
          onPointerDown={() => startMove('down')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute bottom-2 w-16 h-20 rounded-b-2xl bg-gradient-to-t from-slate-800 to-slate-850 hover:bg-slate-700 active:from-cyan-500 active:to-cyan-600 active:text-slate-950 flex items-center justify-center text-slate-200 shadow-md transition-all active:scale-95"
        >
          <ArrowDown className="w-6 h-6" />
        </button>

        {/* LEFT */}
        <button
          onPointerDown={() => startMove('left')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute left-2 h-16 w-20 rounded-l-2xl bg-gradient-to-r from-slate-800 to-slate-850 hover:bg-slate-700 active:from-cyan-500 active:to-cyan-600 active:text-slate-950 flex items-center justify-center text-slate-200 shadow-md transition-all active:scale-95"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* RIGHT */}
        <button
          onPointerDown={() => startMove('right')}
          onPointerUp={stopMove}
          onPointerLeave={stopMove}
          className="absolute right-2 h-16 w-20 rounded-r-2xl bg-gradient-to-l from-slate-800 to-slate-850 hover:bg-slate-700 active:from-cyan-500 active:to-cyan-600 active:text-slate-950 flex items-center justify-center text-slate-200 shadow-md transition-all active:scale-95"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Center Button (OK / Click) */}
        <button
          onClick={handleCenterClick}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-bold text-sm tracking-wider flex items-center justify-center shadow-lg shadow-cyan-500/20 active:scale-95 z-10 transition-transform"
        >
          OK
        </button>
      </div>

      {/* Quick Status */}
      <div className="text-[11px] font-mono text-slate-500 text-center">
        Press &amp; Hold for continuous stepped movement
      </div>
    </div>
  );
};
