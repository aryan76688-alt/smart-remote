import React, { useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MousePointer,
  ChevronDown, ChevronUp, Sliders, Play, Pause, Camera, RefreshCw
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { api } from '../../services/api';

interface MirrorOverlayControlsProps {
  onScreenshot: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  quality: number;
  onChangeQuality: (q: number) => void;
  fps: number;
  onChangeFps: (f: number) => void;
}

export const MirrorOverlayControls: React.FC<MirrorOverlayControlsProps> = ({
  onScreenshot, isPaused, onTogglePause, quality, onChangeQuality, fps, onChangeFps
}) => {
  const { sendInput } = useWebSocket();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const handleDpad = (dir: string) => {
    sendInput({ type: 'dpad', direction: dir, step: 25 });
  };

  const handleMouseClick = (button: number) => {
    sendInput({ type: 'click', button });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleScroll = (deltaY: number) => {
    sendInput({ type: 'scroll', delta_y: deltaY });
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none select-none flex justify-center">
      <div className="pointer-events-auto bg-cyber-surface/90 border border-cyan-500/40 backdrop-blur-xl rounded-2xl shadow-2xl p-3 max-w-lg w-full space-y-2.5">
        {/* Top Mini Control Bar */}
        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={onTogglePause}
              className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 ${
                isPaused
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              onClick={onScreenshot}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 flex items-center space-x-1"
              title="Capture Screenshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Shot</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border ${
                showSettings ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
              title="Stream Quality"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-slate-400 hover:text-white"
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Quality Settings Panel */}
        {showSettings && (
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span>Quality ({quality}%)</span>
              <input
                type="range"
                min="20"
                max="90"
                step="5"
                value={quality}
                onChange={e => onChangeQuality(Number(e.target.value))}
                className="w-36 accent-cyan-400"
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Framerate ({fps} FPS)</span>
              <div className="flex space-x-1">
                {[15, 25, 30].map(f => (
                  <button
                    key={f}
                    onClick={() => onChangeFps(f)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      fps === f ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Input Controls (D-Pad, Mouse, Scroll) */}
        {!collapsed && (
          <div className="flex items-center justify-between pt-1">
            {/* D-Pad */}
            <div className="grid grid-cols-3 gap-1 w-28 h-28">
              <div />
              <button
                onClick={() => handleDpad('up')}
                className="bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 rounded-lg flex items-center justify-center text-slate-300"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div />
              <button
                onClick={() => handleDpad('left')}
                className="bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 rounded-lg flex items-center justify-center text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleMouseClick(1)}
                className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg flex items-center justify-center text-cyan-400 font-bold text-xs"
              >
                ●
              </button>
              <button
                onClick={() => handleDpad('right')}
                className="bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 rounded-lg flex items-center justify-center text-slate-300"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <div />
              <button
                onClick={() => handleDpad('down')}
                className="bg-slate-800 hover:bg-slate-700 active:bg-cyan-500 active:text-slate-950 rounded-lg flex items-center justify-center text-slate-300"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <div />
            </div>

            {/* Mouse Buttons [ L ] [ M ] [ R ] */}
            <div className="flex flex-col space-y-1.5 flex-1 px-3">
              <div className="text-[10px] text-center font-mono text-slate-400">MOUSE BUTTONS</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleMouseClick(1)}
                  className="py-3 rounded-xl bg-cyan-600/30 border border-cyan-500/50 hover:bg-cyan-500 text-cyan-200 font-bold text-xs active:scale-95"
                >
                  L
                </button>
                <button
                  onClick={() => handleMouseClick(2)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs active:scale-95"
                >
                  M
                </button>
                <button
                  onClick={() => handleMouseClick(3)}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs active:scale-95"
                >
                  R
                </button>
              </div>
            </div>

            {/* Scroll Buttons */}
            <div className="flex flex-col space-y-1.5 w-12">
              <div className="text-[10px] text-center font-mono text-slate-400">SCROLL</div>
              <button
                onClick={() => handleScroll(2)}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleScroll(-2)}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
