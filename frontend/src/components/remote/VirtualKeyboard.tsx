import React, { useState } from 'react';
import {
  Keyboard, CornerDownLeft, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Send, Hash, Terminal, Grid, Shield, Sparkles, Volume2, Maximize2
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';

export const VirtualKeyboard: React.FC = () => {
  const { sendInput } = useWebSocket();
  const { addNotification } = useApp();

  const [activeLayout, setActiveLayout] = useState<'pc_full' | 'compact' | 'numpad' | 'macros'>('pc_full');
  const [ctrlActive, setCtrlActive] = useState<boolean>(false);
  const [altActive, setAltActive] = useState<boolean>(false);
  const [shiftActive, setShiftActive] = useState<boolean>(false);
  const [superActive, setSuperActive] = useState<boolean>(false);
  const [capsActive, setCapsActive] = useState<boolean>(false);
  const [quickText, setQuickText] = useState<string>('');

  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const handleKeyPress = (key: string, customModifiers?: string[]) => {
    const modifiers: string[] = customModifiers || [];
    if (!customModifiers) {
      if (ctrlActive) modifiers.push('ctrl');
      if (altActive) modifiers.push('alt');
      if (shiftActive) modifiers.push('shift');
      if (superActive) modifiers.push('super');
    }

    sendInput({
      type: 'key',
      key,
      modifiers
    });

    triggerHaptic(12);

    // Reset non-locked modifiers
    if (modifiers.length > 0 && !customModifiers) {
      setCtrlActive(false);
      setAltActive(false);
      setShiftActive(false);
      setSuperActive(false);
    }
  };

  const handleQuickTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickText) return;
    sendInput({ type: 'type', text: quickText });
    triggerHaptic(20);
    addNotification('Text Sent', `Sent "${quickText}" to workstation`, 'info');
    setQuickText('');
  };

  const handleQuickTextWithEnter = () => {
    if (!quickText) return;
    sendInput({ type: 'type', text: quickText });
    sendInput({ type: 'key', key: 'Return' });
    triggerHaptic(25);
    addNotification('Command Executed', `Sent "${quickText}" + Enter`, 'info');
    setQuickText('');
  };

  // Keyboard Rows
  const fRow = ['ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
  const navRow = ['Insert', 'Delete', 'Home', 'End', 'Page_Up', 'Page_Down', 'Print', 'Scroll_Lock', 'Pause'];
  const numRow = ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  const qwerty1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'];
  const qwerty2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\''];
  const qwerty3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];

  const terminalMacros = [
    { label: 'Ctrl+C (Kill)', key: 'c', mod: ['ctrl'], color: 'text-rose-400 border-rose-500/30' },
    { label: 'Ctrl+Z (Suspend)', key: 'z', mod: ['ctrl'], color: 'text-amber-400 border-amber-500/30' },
    { label: 'Ctrl+D (EOF)', key: 'd', mod: ['ctrl'], color: 'text-cyan-400 border-cyan-500/30' },
    { label: 'Ctrl+L (Clear)', key: 'l', mod: ['ctrl'], color: 'text-emerald-400 border-emerald-500/30' },
    { label: 'Ctrl+Alt+T (Terminal)', key: 't', mod: ['ctrl', 'alt'], color: 'text-cyan-300 border-cyan-500/40' },
    { label: 'Alt+Tab (Switch)', key: 'Tab', mod: ['alt'], color: 'text-purple-400 border-purple-500/30' },
    { label: 'Super+D (Desktop)', key: 'd', mod: ['super'], color: 'text-blue-400 border-blue-500/30' },
    { label: 'Ctrl+Shift+C (Copy)', key: 'c', mod: ['ctrl', 'shift'], color: 'text-slate-300 border-slate-700' },
    { label: 'Ctrl+Shift+V (Paste)', key: 'v', mod: ['ctrl', 'shift'], color: 'text-slate-300 border-slate-700' },
  ];

  return (
    <div className="flex flex-col h-full space-y-2 select-none">
      
      {/* 2.0 Header & Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-2 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Keyboard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-100 tracking-wider">SMART KEYBOARD</span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">2.0</span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Full PC F1-F12, Navigation & Linux Terminal Controller</p>
          </div>
        </div>

        {/* Layout Mode Pills */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
          {[
            { id: 'pc_full', label: 'F1-F12 Full', icon: Maximize2 },
            { id: 'compact', label: 'QWERTY', icon: Keyboard },
            { id: 'numpad', label: 'NumPad', icon: Hash },
            { id: 'macros', label: 'Macros', icon: Terminal },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveLayout(tab.id as any);
                triggerHaptic(10);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                activeLayout === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Direct Native Keyboard Input Bar */}
      <form onSubmit={handleQuickTextSubmit} className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-1.5">
        <input
          type="text"
          value={quickText}
          onChange={e => setQuickText(e.target.value)}
          placeholder="Type here with phone keyboard..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={() => handleQuickTextSubmit()}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono flex items-center gap-1 transition-colors active:scale-95"
          title="Send text"
        >
          <Send className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Send</span>
        </button>
        <button
          type="button"
          onClick={handleQuickTextWithEnter}
          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition-colors active:scale-95 shadow-sm"
          title="Send text and press Enter"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>Enter</span>
        </button>
      </form>

      {/* Main Virtual Key Deck */}
      <div className="flex-1 bg-slate-950/85 border border-slate-800/90 rounded-2xl p-2 flex flex-col justify-between space-y-1.5 overflow-y-auto">

        {/* 1. DEDICATED F1-F12 FUNCTION ROW (Always visible in pc_full and compact) */}
        {(activeLayout === 'pc_full' || activeLayout === 'compact') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono uppercase text-cyan-400/90 font-semibold tracking-wider">Function Keys (F1–F12)</span>
              <span className="text-[9px] font-mono text-slate-500">Tap to execute on Kali</span>
            </div>
            <div className="grid grid-cols-13 gap-1 overflow-x-auto pb-0.5">
              {fRow.map(k => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className={`py-2 rounded-lg text-[10px] sm:text-xs font-mono font-bold border transition-all active:scale-90 active:bg-cyan-500 active:text-slate-950 ${
                    k === 'ESC'
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:border-cyan-500/40'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. PC NAVIGATION & SYSTEM KEYS ROW (in pc_full mode) */}
        {activeLayout === 'pc_full' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono uppercase text-purple-400/90 font-semibold tracking-wider">Navigation & Editing</span>
            </div>
            <div className="grid grid-cols-9 gap-1 overflow-x-auto pb-0.5">
              {navRow.map(k => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className="py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-[10px] font-mono text-purple-300 hover:border-purple-500/40 active:bg-purple-500 active:text-slate-950 transition-all active:scale-90"
                >
                  {k.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. NUMPAD & MACROS LAYOUT */}
        {activeLayout === 'numpad' && (
          <div className="grid grid-cols-4 gap-2 p-2 max-w-sm mx-auto w-full">
            {[
              { k: 'Num_Lock', label: 'Num' }, { k: 'kp_divide', label: '/' }, { k: 'kp_multiply', label: '*' }, { k: 'BackSpace', label: '⌫' },
              { k: 'kp_7', label: '7' }, { k: 'kp_8', label: '8' }, { k: 'kp_9', label: '9' }, { k: 'kp_subtract', label: '-' },
              { k: 'kp_4', label: '4' }, { k: 'kp_5', label: '5' }, { k: 'kp_6', label: '6' }, { k: 'kp_add', label: '+' },
              { k: 'kp_1', label: '1' }, { k: 'kp_2', label: '2' }, { k: 'kp_3', label: '3' }, { k: 'kp_enter', label: 'Enter', span: 'row-span-2' },
              { k: 'kp_0', label: '0', colSpan: 'col-span-2' }, { k: 'kp_decimal', label: '.' },
            ].map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleKeyPress(btn.k)}
                className={`p-4 rounded-xl border text-sm font-mono font-bold transition-all active:scale-90 ${
                  btn.label === 'Enter'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-100 hover:border-cyan-500/50'
                } ${btn.colSpan || ''}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* 4. TERMINAL MACROS LAYOUT */}
        {activeLayout === 'macros' && (
          <div className="space-y-2 p-1">
            <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold">Linux & Kali Shell Combinations</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {terminalMacros.map(macro => (
                <button
                  key={macro.label}
                  onClick={() => handleKeyPress(macro.key, macro.mod)}
                  className={`p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border text-xs font-mono font-bold flex items-center justify-between active:scale-95 transition-all ${macro.color}`}
                >
                  <span>{macro.label}</span>
                  <Terminal className="w-3.5 h-3.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. STANDARD QWERTY KEYBOARD (Available in pc_full and compact) */}
        {(activeLayout === 'pc_full' || activeLayout === 'compact') && (
          <>
            {/* Number Row */}
            <div className="grid grid-cols-13 gap-1">
              {numRow.map(k => (
                <button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  className="py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-200 active:bg-cyan-500 active:text-slate-950 transition-colors"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* QWERTY Row 1 */}
            <div className="flex space-x-1">
              <button
                onClick={() => handleKeyPress('Tab')}
                className="w-12 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400 active:bg-cyan-500 active:text-slate-950"
              >
                Tab
              </button>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {qwerty1.map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(shiftActive || capsActive ? k.toUpperCase() : k)}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-xs font-mono font-semibold text-slate-200 active:bg-cyan-500 active:text-slate-950 uppercase transition-colors"
                  >
                    {shiftActive || capsActive ? k.toUpperCase() : k}
                  </button>
                ))}
              </div>
            </div>

            {/* QWERTY Row 2 */}
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  setCapsActive(!capsActive);
                  handleKeyPress('Caps_Lock');
                }}
                className={`w-14 py-2.5 rounded-lg text-[11px] font-mono font-bold border transition-colors ${
                  capsActive ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                Caps
              </button>
              <div className="flex-1 grid grid-cols-11 gap-1">
                {qwerty2.map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(shiftActive || capsActive ? k.toUpperCase() : k)}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-xs font-mono font-semibold text-slate-200 active:bg-cyan-500 active:text-slate-950 uppercase transition-colors"
                  >
                    {shiftActive || capsActive ? k.toUpperCase() : k}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleKeyPress('Return')}
                className="w-14 py-2.5 bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/50 rounded-lg text-[11px] font-mono font-bold text-cyan-200 flex items-center justify-center active:scale-95 transition-all"
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
            </div>

            {/* QWERTY Row 3 */}
            <div className="flex space-x-1">
              <button
                onClick={() => setShiftActive(!shiftActive)}
                className={`w-14 py-2.5 rounded-lg text-[11px] font-mono font-bold border transition-colors ${
                  shiftActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                Shift
              </button>
              <div className="flex-1 grid grid-cols-10 gap-1">
                {qwerty3.map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeyPress(shiftActive || capsActive ? k.toUpperCase() : k)}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-lg text-xs font-mono font-semibold text-slate-200 active:bg-cyan-500 active:text-slate-950 uppercase transition-colors"
                  >
                    {shiftActive || capsActive ? k.toUpperCase() : k}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleKeyPress('BackSpace')}
                className="w-14 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 flex items-center justify-center active:bg-rose-500 active:text-white transition-colors"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Modifiers & Space Bar & Dedicated Arrows */}
            <div className="flex space-x-1 pt-0.5">
              <button
                onClick={() => setCtrlActive(!ctrlActive)}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  ctrlActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                Ctrl
              </button>
              <button
                onClick={() => setAltActive(!altActive)}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  altActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                Alt
              </button>
              <button
                onClick={() => setSuperActive(!superActive)}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  superActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                Super
              </button>

              {/* Space */}
              <button
                onClick={() => handleKeyPress('space')}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 active:bg-cyan-500 active:text-slate-950 transition-colors"
              >
                Space
              </button>

              {/* Inverted-T Directional Arrow Cluster */}
              <div className="flex items-center space-x-0.5 pl-1">
                <button
                  onClick={() => handleKeyPress('Left')}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 active:bg-cyan-500 active:text-slate-950 transition-colors"
                  title="Arrow Left"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex flex-col space-y-0.5">
                  <button
                    onClick={() => handleKeyPress('Up')}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 active:bg-cyan-500 active:text-slate-950 transition-colors"
                    title="Arrow Up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleKeyPress('Down')}
                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 active:bg-cyan-500 active:text-slate-950 transition-colors"
                    title="Arrow Down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={() => handleKeyPress('Right')}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 active:bg-cyan-500 active:text-slate-950 transition-colors"
                  title="Arrow Right"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default VirtualKeyboard;
