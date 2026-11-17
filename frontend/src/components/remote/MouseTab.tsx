import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Mouse, Move } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

export const MouseTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const [speed, setSpeed] = useState<number>(30);

  const handleClick = (btn: number) => {
    sendInput({ type: 'click', button: btn });
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handleDoubleClick = (btn: number) => {
    sendInput({ type: 'doubleclick', button: btn });
    if (navigator.vibrate) navigator.vibrate([15, 20]);
  };

  const handleScroll = (deltaY: number) => {
    sendInput({ type: 'scroll', delta_y: deltaY });
  };

  return (
    <div className="flex flex-col h-full space-y-4 select-none">
      <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
        <Mouse className="w-4 h-4" />
        <span>Dedicated Mouse Console</span>
      </div>

      {/* Main Mouse Click Buttons */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        <button
          onClick={() => handleClick(1)}
          onDoubleClick={() => handleDoubleClick(1)}
          className="rounded-2xl bg-gradient-to-br from-cyan-600/30 to-slate-900 border-2 border-cyan-500/40 hover:border-cyan-400 text-slate-100 font-bold text-base flex flex-col items-center justify-center space-y-1 active:scale-98 transition-transform shadow-lg shadow-cyan-500/10"
        >
          <span className="text-xl text-cyan-300">LEFT CLICK</span>
          <span className="text-xs text-slate-400 font-normal">Double-tap for double click</span>
        </button>

        <button
          onClick={() => handleClick(3)}
          className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700 hover:border-slate-600 text-slate-100 font-bold text-base flex flex-col items-center justify-center space-y-1 active:scale-98 transition-transform shadow-lg"
        >
          <span className="text-xl text-slate-200">RIGHT CLICK</span>
          <span className="text-xs text-slate-400 font-normal">Context Menu</span>
        </button>
      </div>

      {/* Middle & Scroll Controls */}
      <div className="grid grid-cols-3 gap-3 h-28">
        <button
          onClick={() => handleScroll(3)}
          className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-200 flex flex-col items-center justify-center space-y-1 active:scale-95 transition-transform"
        >
          <ArrowUp className="w-6 h-6 text-cyan-400" />
          <span className="text-xs font-mono">SCROLL UP</span>
        </button>

        <button
          onClick={() => handleClick(2)}
          className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-200 flex flex-col items-center justify-center space-y-1 active:scale-95 transition-transform"
        >
          <Move className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-mono">MIDDLE CLICK</span>
        </button>

        <button
          onClick={() => handleScroll(-3)}
          className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-200 flex flex-col items-center justify-center space-y-1 active:scale-95 transition-transform"
        >
          <ArrowDown className="w-6 h-6 text-cyan-400" />
          <span className="text-xs font-mono">SCROLL DOWN</span>
        </button>
      </div>
    </div>
  );
};
