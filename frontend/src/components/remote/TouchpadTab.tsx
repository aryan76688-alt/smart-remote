import React, { useRef, useState } from 'react';
import { Sliders, MousePointer, Hand } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

export const TouchpadTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const [sensitivity, setSensitivity] = useState<number>(1.5);
  const [acceleration, setAcceleration] = useState<boolean>(true);
  const [invertScroll, setInvertScroll] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Use TypeScript quality rule: useRef<number | undefined>(undefined)
  const lastXRef = useRef<number | undefined>(undefined);
  const lastYRef = useRef<number | undefined>(undefined);
  const touchStartRef = useRef<number | undefined>(undefined);
  const touchCountRef = useRef<number>(0);
  const longPressTimerRef = useRef<number | undefined>(undefined);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;
    touchStartRef.current = Date.now();
    touchCountRef.current += 1;

    // Detect tap-and-hold to drag
    longPressTimerRef.current = window.setTimeout(() => {
      setIsDragging(true);
      sendInput({ type: 'mousedown', button: 1 });
      if (navigator.vibrate) navigator.vibrate([30, 40]);
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lastXRef.current === undefined || lastYRef.current === undefined) return;

    const dx = e.clientX - lastXRef.current;
    const dy = e.clientY - lastYRef.current;

    // Clear long press if movement exceeds threshold
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (longPressTimerRef.current !== undefined) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = undefined;
      }
    }

    lastXRef.current = e.clientX;
    lastYRef.current = e.clientY;

    if (touchCountRef.current > 1) {
      // 2 fingers = scroll
      const dir = invertScroll ? -1 : 1;
      const scrollY = dy * 0.15 * dir;
      sendInput({ type: 'scroll', delta_y: scrollY });
    } else {
      // 1 finger = move
      let factor = sensitivity;
      if (acceleration) {
        const speed = Math.sqrt(dx * dx + dy * dy);
        factor *= (1 + speed * 0.05);
      }
      sendInput({ type: 'move_rel', x: dx * factor, y: dy * factor });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current !== undefined) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }

    if (isDragging) {
      setIsDragging(false);
      sendInput({ type: 'mouseup', button: 1 });
      if (navigator.vibrate) navigator.vibrate(20);
    } else if (touchStartRef.current !== undefined && Date.now() - touchStartRef.current < 250) {
      // Tap detected
      if (touchCountRef.current > 1) {
        // 2-finger tap = right click
        sendInput({ type: 'click', button: 3 });
      } else {
        // 1-finger tap = left click
        sendInput({ type: 'click', button: 1 });
      }
      if (navigator.vibrate) navigator.vibrate(15);
    }

    lastXRef.current = undefined;
    lastYRef.current = undefined;
    touchStartRef.current = undefined;
    touchCountRef.current = Math.max(0, touchCountRef.current - 1);
  };

  return (
    <div className="flex flex-col h-full space-y-3 select-none">
      {/* Settings / Controls Toggle */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300">
          <Hand className="w-4 h-4" />
          <span>TOUCHPAD MODE {isDragging && <strong className="text-amber-400 font-bold ml-2">[DRAGGING]</strong>}</span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 ${
            showSettings ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Config</span>
        </button>
      </div>

      {showSettings && (
        <div className="p-3 bg-cyber-surface border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span>Sensitivity ({sensitivity.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.1"
              value={sensitivity}
              onChange={e => setSensitivity(Number(e.target.value))}
              className="w-36 accent-cyan-400"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <span>Acceleration</span>
            <input
              type="checkbox"
              checked={acceleration}
              onChange={e => setAcceleration(e.target.checked)}
              className="accent-cyan-400 w-4 h-4 rounded"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <span>Invert Scrolling</span>
            <input
              type="checkbox"
              checked={invertScroll}
              onChange={e => setInvertScroll(e.target.checked)}
              className="accent-cyan-400 w-4 h-4 rounded"
            />
          </div>
        </div>
      )}

      {/* Main Touch Canvas Area */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`flex-1 rounded-2xl border-2 transition-all flex flex-col items-center justify-center p-6 text-center touch-control-area ${
          isDragging
            ? 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10'
            : 'bg-gradient-to-b from-slate-900/80 to-slate-950/90 border-slate-800 hover:border-cyan-500/50'
        }`}
      >
        <MousePointer className={`w-10 h-10 mb-2 transition-colors ${isDragging ? 'text-amber-400 animate-bounce' : 'text-slate-600'}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Touchpad Surface
        </span>
        <div className="text-[11px] text-slate-500 mt-2 space-y-1">
          <p>1 Finger: Move Cursor • Tap: Left Click</p>
          <p>2 Fingers: Tap for Right Click • Slide to Scroll</p>
          <p>Hold: Drag &amp; Drop</p>
        </div>
      </div>

      {/* Bottom Physical Mouse Buttons */}
      <div className="grid grid-cols-3 gap-2 h-16">
        <button
          onClick={() => {
            sendInput({ type: 'click', button: 1 });
            if (navigator.vibrate) navigator.vibrate(15);
          }}
          className="rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-200 font-bold text-sm active:scale-95 transition-transform flex flex-col items-center justify-center shadow-sm"
        >
          <span>LEFT</span>
          <span className="text-[9px] text-cyan-400 font-mono">PRIMARY</span>
        </button>
        <button
          onClick={() => {
            sendInput({ type: 'click', button: 2 });
            if (navigator.vibrate) navigator.vibrate(15);
          }}
          className="rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm active:scale-95 transition-transform flex flex-col items-center justify-center"
        >
          <span>MIDDLE</span>
          <span className="text-[9px] text-slate-500 font-mono">SCROLL CLICK</span>
        </button>
        <button
          onClick={() => {
            sendInput({ type: 'click', button: 3 });
            if (navigator.vibrate) navigator.vibrate(15);
          }}
          className="rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-sm active:scale-95 transition-transform flex flex-col items-center justify-center"
        >
          <span>RIGHT</span>
          <span className="text-[9px] text-slate-500 font-mono">CONTEXT</span>
        </button>
      </div>
    </div>
  );
};
