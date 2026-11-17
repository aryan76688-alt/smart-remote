import React, { useState, useRef, useEffect } from 'react';
import {
  Gamepad2, Zap, RotateCcw, Crosshair, Volume2, Shield,
  Radio, Play, Square, Circle, Triangle, Disc, Sliders, ChevronRight
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';

type GamePreset = 'fps' | 'retro' | 'racing' | 'custom';

export const GamingConsoleTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const { addNotification } = useApp();

  const [preset, setPreset] = useState<GamePreset>('fps');
  const [turboMode, setTurboMode] = useState<boolean>(false);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set());

  // Left Joystick (Movement: WASD / D-Pad)
  const leftStickRef = useRef<HTMLDivElement | null>(null);
  const [leftStickPos, setLeftStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const leftTouchIdRef = useRef<number | null>(null);
  const leftActiveKeyRef = useRef<string | null>(null);

  // Right Joystick (Aim / Camera: Mouse Look)
  const rightStickRef = useRef<HTMLDivElement | null>(null);
  const [rightStickPos, setRightStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const rightTouchIdRef = useRef<number | null>(null);
  const rightAimIntervalRef = useRef<number | null>(null);
  const rightStickDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const triggerHaptic = (duration = 15) => {
    if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  };

  // Button mapping configurations for presets
  const getButtonKey = (btn: 'A' | 'B' | 'X' | 'Y' | 'L1' | 'R1' | 'L2' | 'R2' | 'SELECT' | 'START' | 'HOME') => {
    if (preset === 'fps') {
      switch (btn) {
        case 'A': return 'space';      // Jump
        case 'B': return 'ctrl';       // Crouch
        case 'X': return 'r';          // Reload
        case 'Y': return 'e';          // Use / Interact
        case 'L1': return 'shift';     // Sprint
        case 'R1': return 'click_1';   // Fire (Left Click)
        case 'L2': return 'click_3';   // Aim (Right Click)
        case 'R2': return 'click_2';   // Middle click
        case 'SELECT': return 'tab';   // Scoreboard
        case 'START': return 'escape'; // Pause
        case 'HOME': return 'super';   // Menu
      }
    } else if (preset === 'retro') {
      switch (btn) {
        case 'A': return 'z';          // Jump / Action 1
        case 'B': return 'x';          // Attack / Action 2
        case 'X': return 'c';          // Special
        case 'Y': return 'v';          // Secondary
        case 'L1': return 'a';         // L-Shoulder
        case 'R1': return 's';         // R-Shoulder
        case 'L2': return 'q';
        case 'R2': return 'w';
        case 'SELECT': return 'shift'; // Insert Coin / Select
        case 'START': return 'return'; // Start
        case 'HOME': return 'escape';
      }
    } else if (preset === 'racing') {
      switch (btn) {
        case 'A': return 'space';      // Handbrake
        case 'B': return 'c';          // Change Camera
        case 'X': return 'shift';      // Nitro
        case 'Y': return 'r';          // Reset Car
        case 'L1': return 'down';      // Brake
        case 'R1': return 'up';        // Accelerate
        case 'L2': return 's';         // Reverse
        case 'R2': return 'w';         // Throttle
        case 'SELECT': return 'tab';
        case 'START': return 'escape';
        case 'HOME': return 'super';
      }
    }
    // Default custom
    return 'space';
  };

  const handleButtonDown = (btn: 'A' | 'B' | 'X' | 'Y' | 'L1' | 'R1' | 'L2' | 'R2' | 'SELECT' | 'START' | 'HOME') => {
    triggerHaptic(20);
    setActiveButtons(prev => new Set(prev).add(btn));

    const keyOrAction = getButtonKey(btn);
    if (keyOrAction.startsWith('click_')) {
      const btnNum = parseInt(keyOrAction.replace('click_', ''), 10);
      sendInput({ type: 'mousedown', button: btnNum });
    } else {
      sendInput({ type: 'keydown', key: keyOrAction });
      if (turboMode) {
        sendInput({ type: 'key', key: keyOrAction });
      }
    }
  };

  const handleButtonUp = (btn: 'A' | 'B' | 'X' | 'Y' | 'L1' | 'R1' | 'L2' | 'R2' | 'SELECT' | 'START' | 'HOME') => {
    setActiveButtons(prev => {
      const next = new Set(prev);
      next.delete(btn);
      return next;
    });

    const keyOrAction = getButtonKey(btn);
    if (keyOrAction.startsWith('click_')) {
      const btnNum = parseInt(keyOrAction.replace('click_', ''), 10);
      sendInput({ type: 'mouseup', button: btnNum });
    } else {
      sendInput({ type: 'keyup', key: keyOrAction });
    }
  };

  // D-Pad Touch Handlers
  const handleDPadPress = (dir: string) => {
    triggerHaptic(15);
    if (preset === 'fps') {
      const keyMap: Record<string, string> = { up: 'w', down: 's', left: 'a', right: 'd' };
      sendInput({ type: 'keydown', key: keyMap[dir] || dir });
      setTimeout(() => sendInput({ type: 'keyup', key: keyMap[dir] || dir }), 80);
    } else {
      sendInput({ type: 'keydown', key: dir });
      setTimeout(() => sendInput({ type: 'keyup', key: dir }), 80);
    }
  };

  // Left Joystick Movement Logic
  const handleLeftTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    leftTouchIdRef.current = touch.identifier;
    updateLeftStick(touch.clientX, touch.clientY);
  };

  const handleLeftTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === leftTouchIdRef.current) {
        updateLeftStick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleLeftTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === leftTouchIdRef.current) {
        leftTouchIdRef.current = null;
        setLeftStickPos({ x: 0, y: 0 });
        if (leftActiveKeyRef.current) {
          sendInput({ type: 'keyup', key: leftActiveKeyRef.current });
          leftActiveKeyRef.current = null;
        }
        break;
      }
    }
  };

  const updateLeftStick = (clientX: number, clientY: number) => {
    if (!leftStickRef.current) return;
    const rect = leftStickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxDist = rect.width / 2;
    const dist = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxDist) {
      normX = (dx / dist) * maxDist;
      normY = (dy / dist) * maxDist;
    }

    setLeftStickPos({ x: normX, y: normY });

    // Determine directional key based on vector
    if (dist > 18) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
      let key = 'w';
      if (angle >= -45 && angle <= 45) {
        key = preset === 'fps' ? 'd' : 'right';
      } else if (angle > 45 && angle < 135) {
        key = preset === 'fps' ? 's' : 'down';
      } else if (angle >= 135 || angle <= -135) {
        key = preset === 'fps' ? 'a' : 'left';
      } else {
        key = preset === 'fps' ? 'w' : 'up';
      }

      if (leftActiveKeyRef.current !== key) {
        if (leftActiveKeyRef.current) {
          sendInput({ type: 'keyup', key: leftActiveKeyRef.current });
        }
        sendInput({ type: 'keydown', key });
        leftActiveKeyRef.current = key;
        triggerHaptic(10);
      }
    } else {
      if (leftActiveKeyRef.current) {
        sendInput({ type: 'keyup', key: leftActiveKeyRef.current });
        leftActiveKeyRef.current = null;
      }
    }
  };

  // Right Joystick Aim / Camera Look Loop
  const handleRightTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    rightTouchIdRef.current = touch.identifier;
    updateRightStick(touch.clientX, touch.clientY);

    // Start 60fps / 120fps smooth aim loop
    if (!rightAimIntervalRef.current) {
      rightAimIntervalRef.current = window.setInterval(() => {
        const { dx, dy } = rightStickDeltaRef.current;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          sendInput({ type: 'move_rel', x: dx * 0.45, y: dy * 0.45 });
        }
      }, 16);
    }
  };

  const handleRightTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === rightTouchIdRef.current) {
        updateRightStick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleRightTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === rightTouchIdRef.current) {
        rightTouchIdRef.current = null;
        setRightStickPos({ x: 0, y: 0 });
        rightStickDeltaRef.current = { dx: 0, dy: 0 };
        if (rightAimIntervalRef.current) {
          clearInterval(rightAimIntervalRef.current);
          rightAimIntervalRef.current = null;
        }
        break;
      }
    }
  };

  const updateRightStick = (clientX: number, clientY: number) => {
    if (!rightStickRef.current) return;
    const rect = rightStickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxDist = rect.width / 2;
    const dist = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxDist) {
      normX = (dx / dist) * maxDist;
      normY = (dy / dist) * maxDist;
    }

    setRightStickPos({ x: normX, y: normY });
    rightStickDeltaRef.current = { dx: normX, dy: normY };
  };

  useEffect(() => {
    return () => {
      if (rightAimIntervalRef.current) clearInterval(rightAimIntervalRef.current);
      if (leftActiveKeyRef.current) sendInput({ type: 'keyup', key: leftActiveKeyRef.current });
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full select-none justify-between p-2 sm:p-4 overflow-y-auto font-sans pb-20">
      {/* Console Top Header: Presets, Turbo & Haptic Toggles */}
      <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2 px-3 shrink-0 mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>GAME CONSOLE</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                {preset.toUpperCase()}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Samsung A36 120Hz Pro Controller
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Preset Switcher */}
          <select
            value={preset}
            onChange={e => {
              setPreset(e.target.value as GamePreset);
              addNotification('Game Preset', `Profile switched to ${e.target.value.toUpperCase()}`, 'info');
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-cyan-300 font-mono focus:outline-none"
          >
            <option value="fps">FPS / Action</option>
            <option value="retro">Retro Arcade</option>
            <option value="racing">Racing Sim</option>
          </select>

          {/* Turbo Toggle */}
          <button
            onClick={() => setTurboMode(!turboMode)}
            className={`p-1.5 px-2.5 rounded-xl border text-[11px] font-bold font-mono transition-all ${
              turboMode ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Turbo Rapid Fire"
          >
            TURBO
          </button>

          {/* Vibration Toggle */}
          <button
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              if (next) triggerHaptic(40);
            }}
            className={`p-1.5 rounded-xl border text-xs transition-all ${
              hapticsEnabled ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Haptic Feedback"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Shoulder Bumpers & Triggers (L1, L2, R1, R2) */}
      <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
        <button
          onTouchStart={() => handleButtonDown('L2')}
          onTouchEnd={() => handleButtonUp('L2')}
          onMouseDown={() => handleButtonDown('L2')}
          onMouseUp={() => handleButtonUp('L2')}
          className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center transition-all ${
            activeButtons.has('L2')
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-95 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-cyan-500/40'
          }`}
        >
          <span className="font-mono text-[10px] text-slate-500">LT / AIM</span>
          <span>L2</span>
        </button>

        <button
          onTouchStart={() => handleButtonDown('L1')}
          onTouchEnd={() => handleButtonUp('L1')}
          onMouseDown={() => handleButtonDown('L1')}
          onMouseUp={() => handleButtonUp('L1')}
          className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center transition-all ${
            activeButtons.has('L1')
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-95 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-cyan-500/40'
          }`}
        >
          <span className="font-mono text-[10px] text-slate-500">LB / SPRINT</span>
          <span>L1</span>
        </button>

        <button
          onTouchStart={() => handleButtonDown('R1')}
          onTouchEnd={() => handleButtonUp('R1')}
          onMouseDown={() => handleButtonDown('R1')}
          onMouseUp={() => handleButtonUp('R1')}
          className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center transition-all ${
            activeButtons.has('R1')
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-emerald-500/40'
          }`}
        >
          <span className="font-mono text-[10px] text-slate-500">RB / FIRE</span>
          <span>R1</span>
        </button>

        <button
          onTouchStart={() => handleButtonDown('R2')}
          onTouchEnd={() => handleButtonUp('R2')}
          onMouseDown={() => handleButtonDown('R2')}
          onMouseUp={() => handleButtonUp('R2')}
          className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center transition-all ${
            activeButtons.has('R2')
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-emerald-500/40'
          }`}
        >
          <span className="font-mono text-[10px] text-slate-500">RT / ATTACK</span>
          <span>R2</span>
        </button>
      </div>

      {/* Main Handheld Console Arena: Dual Sticks, D-Pad & Action Diamond */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-4 my-auto">
        {/* Left Side: Left Thumbstick + D-Pad */}
        <div className="flex items-center justify-around w-full lg:w-1/2 gap-4">
          {/* Virtual Left Analog Stick (Movement) */}
          <div className="flex flex-col items-center space-y-1.5">
            <div
              ref={leftStickRef}
              onTouchStart={handleLeftTouchStart}
              onTouchMove={handleLeftTouchMove}
              onTouchEnd={handleLeftTouchEnd}
              className="relative w-36 h-36 rounded-full bg-slate-950/90 border-2 border-cyan-500/30 shadow-2xl flex items-center justify-center touch-none select-none"
            >
              {/* Stick Crosshair Guides */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-slate-800/80 -translate-y-1/2 pointer-events-none" />
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-slate-800/80 -translate-x-1/2 pointer-events-none" />
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 pointer-events-none" />

              {/* Thumb Stick Cap */}
              <div
                style={{
                  transform: `translate3d(${leftStickPos.x}px, ${leftStickPos.y}px, 0)`,
                  transition: leftTouchIdRef.current ? 'none' : 'transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-600 border-2 border-white/40 shadow-xl shadow-cyan-500/30 flex items-center justify-center text-slate-950 font-black text-xs font-mono pointer-events-none"
              >
                L-STICK
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              MOVE (WASD)
            </span>
          </div>

          {/* D-Pad (4-Way Cross) */}
          <div className="flex flex-col items-center space-y-1.5">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Up */}
              <button
                onTouchStart={() => handleDPadPress('up')}
                onClick={() => handleDPadPress('up')}
                className="absolute top-0 w-12 h-12 rounded-t-xl bg-slate-900 border border-slate-700 text-slate-200 active:bg-cyan-500 active:text-slate-950 font-bold flex items-center justify-center text-xs shadow-md"
              >
                ▲
              </button>
              {/* Down */}
              <button
                onTouchStart={() => handleDPadPress('down')}
                onClick={() => handleDPadPress('down')}
                className="absolute bottom-0 w-12 h-12 rounded-b-xl bg-slate-900 border border-slate-700 text-slate-200 active:bg-cyan-500 active:text-slate-950 font-bold flex items-center justify-center text-xs shadow-md"
              >
                ▼
              </button>
              {/* Left */}
              <button
                onTouchStart={() => handleDPadPress('left')}
                onClick={() => handleDPadPress('left')}
                className="absolute left-0 w-12 h-12 rounded-l-xl bg-slate-900 border border-slate-700 text-slate-200 active:bg-cyan-500 active:text-slate-950 font-bold flex items-center justify-center text-xs shadow-md"
              >
                ◀
              </button>
              {/* Right */}
              <button
                onTouchStart={() => handleDPadPress('right')}
                onClick={() => handleDPadPress('right')}
                className="absolute right-0 w-12 h-12 rounded-r-xl bg-slate-900 border border-slate-700 text-slate-200 active:bg-cyan-500 active:text-slate-950 font-bold flex items-center justify-center text-xs shadow-md"
              >
                ▶
              </button>
              {/* Center Pivot */}
              <div className="w-12 h-12 bg-slate-950 border border-slate-800 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-700" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              D-PAD
            </span>
          </div>
        </div>

        {/* Center: SELECT, HOME & START Buttons */}
        <div className="flex items-center justify-center space-x-3 my-2 lg:my-0 shrink-0">
          <button
            onTouchStart={() => handleButtonDown('SELECT')}
            onTouchEnd={() => handleButtonUp('SELECT')}
            onMouseDown={() => handleButtonDown('SELECT')}
            onMouseUp={() => handleButtonUp('SELECT')}
            className={`px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              activeButtons.has('SELECT')
                ? 'bg-slate-200 text-slate-950 border-white scale-95'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            SELECT
          </button>

          <button
            onTouchStart={() => handleButtonDown('HOME')}
            onTouchEnd={() => handleButtonUp('HOME')}
            onMouseDown={() => handleButtonDown('HOME')}
            onMouseUp={() => handleButtonUp('HOME')}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
              activeButtons.has('HOME')
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-95 shadow-lg shadow-cyan-500/40'
                : 'bg-slate-900 border-slate-800 text-cyan-400 hover:border-cyan-500/50'
            }`}
            title="Home (Super/Win)"
          >
            <Disc className="w-4 h-4 animate-spin" />
          </button>

          <button
            onTouchStart={() => handleButtonDown('START')}
            onTouchEnd={() => handleButtonUp('START')}
            onMouseDown={() => handleButtonDown('START')}
            onMouseUp={() => handleButtonUp('START')}
            className={`px-3 py-1.5 rounded-full border text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              activeButtons.has('START')
                ? 'bg-slate-200 text-slate-950 border-white scale-95'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            START
          </button>
        </div>

        {/* Right Side: Action Diamond (A,B,X,Y) + Right Thumbstick (Aim) */}
        <div className="flex items-center justify-around w-full lg:w-1/2 gap-4">
          {/* Action Diamond Buttons */}
          <div className="flex flex-col items-center space-y-1.5">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Y (Top - Amber) */}
              <button
                onTouchStart={() => handleButtonDown('Y')}
                onTouchEnd={() => handleButtonUp('Y')}
                onMouseDown={() => handleButtonDown('Y')}
                onMouseUp={() => handleButtonUp('Y')}
                className={`absolute top-0 w-12 h-12 rounded-full border-2 font-black text-sm flex items-center justify-center transition-transform ${
                  activeButtons.has('Y')
                    ? 'bg-amber-400 text-slate-950 border-amber-300 scale-90 shadow-lg shadow-amber-500/40'
                    : 'bg-slate-900 border-amber-400/50 text-amber-300 shadow-md'
                }`}
              >
                Y
              </button>

              {/* A (Bottom - Green/Cyan) */}
              <button
                onTouchStart={() => handleButtonDown('A')}
                onTouchEnd={() => handleButtonUp('A')}
                onMouseDown={() => handleButtonDown('A')}
                onMouseUp={() => handleButtonUp('A')}
                className={`absolute bottom-0 w-12 h-12 rounded-full border-2 font-black text-sm flex items-center justify-center transition-transform ${
                  activeButtons.has('A')
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300 scale-90 shadow-lg shadow-emerald-500/40'
                    : 'bg-slate-900 border-emerald-400/50 text-emerald-300 shadow-md'
                }`}
              >
                A
              </button>

              {/* X (Left - Blue) */}
              <button
                onTouchStart={() => handleButtonDown('X')}
                onTouchEnd={() => handleButtonUp('X')}
                onMouseDown={() => handleButtonDown('X')}
                onMouseUp={() => handleButtonUp('X')}
                className={`absolute left-0 w-12 h-12 rounded-full border-2 font-black text-sm flex items-center justify-center transition-transform ${
                  activeButtons.has('X')
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 scale-90 shadow-lg shadow-cyan-500/40'
                    : 'bg-slate-900 border-cyan-400/50 text-cyan-300 shadow-md'
                }`}
              >
                X
              </button>

              {/* B (Right - Rose) */}
              <button
                onTouchStart={() => handleButtonDown('B')}
                onTouchEnd={() => handleButtonUp('B')}
                onMouseDown={() => handleButtonDown('B')}
                onMouseUp={() => handleButtonUp('B')}
                className={`absolute right-0 w-12 h-12 rounded-full border-2 font-black text-sm flex items-center justify-center transition-transform ${
                  activeButtons.has('B')
                    ? 'bg-rose-500 text-white border-rose-300 scale-90 shadow-lg shadow-rose-500/40'
                    : 'bg-slate-900 border-rose-400/50 text-rose-300 shadow-md'
                }`}
              >
                B
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              ACTIONS
            </span>
          </div>

          {/* Virtual Right Analog Stick (Camera / Aim / Mouse Look) */}
          <div className="flex flex-col items-center space-y-1.5">
            <div
              ref={rightStickRef}
              onTouchStart={handleRightTouchStart}
              onTouchMove={handleRightTouchMove}
              onTouchEnd={handleRightTouchEnd}
              className="relative w-36 h-36 rounded-full bg-slate-950/90 border-2 border-emerald-500/30 shadow-2xl flex items-center justify-center touch-none select-none"
            >
              {/* Crosshair Guides */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-slate-800/80 -translate-y-1/2 pointer-events-none" />
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-slate-800/80 -translate-x-1/2 pointer-events-none" />
              <div className="w-16 h-16 rounded-full border border-emerald-500/20 pointer-events-none" />

              {/* Thumb Stick Cap */}
              <div
                style={{
                  transform: `translate3d(${rightStickPos.x}px, ${rightStickPos.y}px, 0)`,
                  transition: rightTouchIdRef.current ? 'none' : 'transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 border-2 border-white/40 shadow-xl shadow-emerald-500/30 flex items-center justify-center text-slate-950 font-black text-xs font-mono pointer-events-none"
              >
                R-AIM
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              AIM / LOOK
            </span>
          </div>
        </div>
      </div>

      {/* Controller Mapping Legend */}
      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono shrink-0">
        <span>A: <strong className="text-emerald-300">Space (Jump)</strong></span>
        <span>B: <strong className="text-rose-300">Ctrl (Crouch)</strong></span>
        <span>X: <strong className="text-cyan-300">R (Reload)</strong></span>
        <span>Y: <strong className="text-amber-300">E (Use)</strong></span>
        <span>L1/R1: <strong className="text-slate-200">Sprint / Fire</strong></span>
        <span>L-Stick: <strong className="text-cyan-300">WASD</strong></span>
        <span>R-Stick: <strong className="text-emerald-300">Mouse Look</strong></span>
      </div>
    </div>
  );
};
export default GamingConsoleTab;
