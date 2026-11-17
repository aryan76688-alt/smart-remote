import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Battery,
  BatteryCharging,
  Sliders,
  Sparkles,
  Camera,
  Smartphone,
  ChevronDown,
  Lock,
  Moon,
  RotateCcw,
  Power,
  ShieldCheck,
  Radio,
  Clipboard,
  PictureInPicture2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useVoice } from '../context/VoiceContext';

interface MenuBarProps {
  activeModuleTitle: string;
  onOpenControlCenter: () => void;
  onOpenDynamicIsland: () => void;
  onTriggerSiri: () => void;
  onOpenPearDrop: () => void;
  onOpenClipboard: () => void;
  onTogglePip: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  activeModuleTitle,
  onOpenControlCenter,
  onOpenDynamicIsland,
  onTriggerSiri,
  onOpenPearDrop,
  onOpenClipboard,
  onTogglePip
}) => {
  const { triggerHaptic, addNotification } = useApp();
  const { systemStats, latencyMs } = useWebSocket();
  const { voiceState } = useVoice();
  const isListening = voiceState === 'listening';

  const [appleMenuOpen, setAppleMenuOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [batteryNoticeGiven, setBatteryNoticeGiven] = useState<boolean>(false);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Battery 80% Longevity Protection Alert
  useEffect(() => {
    const pct = systemStats?.battery_percent;
    const plugged = systemStats?.battery_plugged;
    if (pct && pct >= 80 && plugged && !batteryNoticeGiven) {
      addNotification('Battery Health', 'pearOS reached 80% charge. Unplug to preserve battery longevity.', 'info');
      setBatteryNoticeGiven(true);
    } else if (pct && pct < 75) {
      setBatteryNoticeGiven(false);
    }
  }, [systemStats, batteryNoticeGiven]);

  // Hands-Free Voice Wake Word ("Hey Nova" / "Hey pearOS")
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition: any = null;
    try {
      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const phrase = event.results[i][0].transcript.toLowerCase();
          if (phrase.includes('hey nova') || phrase.includes('hey pearos') || phrase.includes('hey jarvis')) {
            triggerHaptic(50);
            addNotification('Voice Co-Pilot', 'Wake word detected', 'success');
            onTriggerSiri();
          }
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {
        try {
          recognition?.start();
        } catch {}
      };

      recognition.start();
    } catch {}

    return () => {
      try {
        recognition?.stop();
      } catch {}
    };
  }, []);

  const handlePowerAction = async (action: string) => {
    setAppleMenuOpen(false);
    triggerHaptic(50);
    try {
      await api.powerAction(action, true);
      addNotification('Power', `${action} command executed`, 'info');
    } catch {}
  };

  const isBattery80 = Boolean((systemStats?.battery_percent ?? 0) >= 80 && systemStats?.battery_plugged);

  return (
    <div className="relative z-[1500] w-full h-8 bg-white/80 backdrop-blur-2xl border-b border-black/5 px-3 flex items-center justify-between text-xs select-none shadow-xs text-slate-800">
      {/* Left: pearOS Apple Menu & Active Module */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => {
              triggerHaptic(20);
              setAppleMenuOpen(!appleMenuOpen);
            }}
            className="flex items-center gap-1 font-bold text-slate-900 hover:text-blue-600 transition-colors"
          >
            <span className="text-sm"></span>
            <span className="font-semibold tracking-tight text-xs">pearOS</span>
          </button>

          {/* Apple Dropdown Menu */}
          {appleMenuOpen && (
            <div
              onClick={() => setAppleMenuOpen(false)}
              className="absolute left-0 top-7 w-48 bg-white/90 backdrop-blur-2xl border border-black/10 rounded-2xl shadow-xl py-1.5 space-y-0.5 animate-in fade-in zoom-in-95"
            >
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">About pearOS Workstation</div>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => handlePowerAction('lock')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Session</span>
              </button>
              <button
                onClick={() => handlePowerAction('suspend')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Sleep Display</span>
              </button>
              <button
                onClick={() => handlePowerAction('reboot')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart pearOS...</span>
              </button>
              <button
                onClick={() => handlePowerAction('shutdown')}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Shut Down pearOS...</span>
              </button>
            </div>
          )}
        </div>

        <span className="text-slate-300 font-light">•</span>
        <span className="font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-none">
          {activeModuleTitle}
        </span>
      </div>

      {/* Center: Dynamic Island Pill */}
      <button
        onClick={() => {
          triggerHaptic(30);
          onOpenDynamicIsland();
        }}
        className="hidden sm:flex items-center gap-2 bg-black/90 hover:bg-black text-white px-3 py-0.5 rounded-full shadow-sm border border-white/20 active:scale-95 transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono tracking-tight text-emerald-300">LIVE CCTV ACTIVE</span>
        <span className="text-slate-500">•</span>
        <span className="text-[10px] font-mono text-slate-300">OPPO 88%</span>
      </button>

      {/* Right: Quick Tools, Status Icons, Siri, Control Center & Clock */}
      <div className="flex items-center gap-2">
        {/* pearDrop Button */}
        <button
          onClick={() => {
            triggerHaptic(20);
            onOpenPearDrop();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1"
          title="pearDrop Fast Share"
        >
          <Radio className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[10px] font-semibold hidden md:inline">pearDrop</span>
        </button>

        {/* Universal Clipboard */}
        <button
          onClick={() => {
            triggerHaptic(20);
            onOpenClipboard();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all"
          title="Universal Clipboard"
        >
          <Clipboard className="w-3.5 h-3.5" />
        </button>

        {/* PiP Mini Floating CCTV */}
        <button
          onClick={() => {
            triggerHaptic(20);
            onTogglePip();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
          title="Floating CCTV Picture-in-Picture"
        >
          <PictureInPicture2 className="w-3.5 h-3.5" />
        </button>

        {/* Siri / Voice Trigger */}
        <button
          onClick={() => {
            triggerHaptic(30);
            onTriggerSiri();
          }}
          className={`p-1 rounded-lg transition-all ${
            isListening ? 'text-rose-500 animate-pulse' : 'text-slate-600 hover:text-blue-600'
          }`}
          title="Voice Co-Pilot (Say 'Hey Nova' or tap)"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        {/* WiFi & Ping */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 hidden sm:flex">
          <Wifi className="w-3.5 h-3.5 text-blue-600" />
          <span>{latencyMs || 8}ms</span>
        </div>

        {/* Battery Indicator with 80% Protection Badge */}
        <div
          className={`flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded-lg border transition-all ${
            isBattery80
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
              : 'text-slate-700 border-transparent'
          }`}
          title={isBattery80 ? 'Battery 80% Health Limit reached' : 'Battery level'}
        >
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
          <span>{systemStats?.battery_percent ?? 88}%</span>
        </div>

        {/* Control Center Toggle */}
        <button
          onClick={() => {
            triggerHaptic(30);
            onOpenControlCenter();
          }}
          className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
          title="Control Center"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Live Clock */}
        <span className="font-medium text-[11px] text-slate-800 hidden lg:inline ml-1 font-mono">
          {currentDate} {currentTime}
        </span>
      </div>
    </div>
  );
};
