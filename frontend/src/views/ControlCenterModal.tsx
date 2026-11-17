import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Lock,
  X,
  ShieldCheck,
  Radio,
  Clipboard,
  Camera,
  Thermometer,
  Wifi,
  Send,
  Skull,
  ExternalLink,
  RefreshCw,
  Headphones,
  Stethoscope,
  Command,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  KeyRound,
  Music,
  ShieldAlert,
  Sparkles,
  PenTool,
  Gamepad2,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { WidgetDashboardView } from './WidgetDashboardView';

interface ControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPearDrop?: () => void;
  onOpenClipboard?: () => void;
  onOpenAudioMaster?: () => void;
  onOpenTeleprompter?: () => void;
  onOpenDrawingTablet?: () => void;
  onOpenGamepad?: () => void;
  onOpenTacticalDefense?: () => void;
  onOpenAiCopilot?: () => void;
}

export const ControlCenterModal: React.FC<ControlCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenPearDrop,
  onOpenClipboard,
  onOpenAudioMaster,
  onOpenTeleprompter,
  onOpenDrawingTablet,
  onOpenGamepad,
  onOpenTacticalDefense,
  onOpenAiCopilot
}) => {
  const { triggerHaptic, addNotification } = useApp();

  const [volume, setVolume] = useState<number>(70);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [stealthActive, setStealthActive] = useState<boolean>(false);
  const [sirenActive, setSirenActive] = useState<boolean>(false);
  const [strobeActive, setStrobeActive] = useState<boolean>(false);

  // StreamDeck Macro State (Feature 11)
  const [executingMacro, setExecutingMacro] = useState<string | null>(null);

  // PC-to-Phone Wireless Audio Player State (Feature 12)
  const [pcAudioStreaming, setPcAudioStreaming] = useState<boolean>(false);
  const pcAudioRef = useRef<HTMLAudioElement | null>(null);

  // System Health Doctor State (Feature 18)
  const [healthScore, setHealthScore] = useState<number>(96);
  const [healthGrade, setHealthGrade] = useState<string>('Optimal');
  const [ramUsedGb, setRamUsedGb] = useState<number>(3.8);
  const [ramTotalGb, setRamTotalGb] = useState<number>(15.4);
  const [isOptimizingDoctor, setIsOptimizingDoctor] = useState<boolean>(false);

  // Stealth Silent Audio Room Snooping (Feature 19)
  const [snoopAudioActive, setSnoopAudioActive] = useState<boolean>(false);
  const snoopAudioRef = useRef<HTMLAudioElement | null>(null);

  // Self-Destruct Decoy PIN State (Feature 20)
  const [decoyModalOpen, setDecoyModalOpen] = useState<boolean>(false);
  const [decoyPinInput, setDecoyPinInput] = useState<string>('');

  // Intruder Trap State
  const [trapArmed, setTrapArmed] = useState<boolean>(false);
  const [intruderPhoto, setIntruderPhoto] = useState<string | null>(null);

  // Tab Handoff State
  const [handoffUrl, setHandoffUrl] = useState<string>('');
  const [isHandoffSending, setIsHandoffSending] = useState<boolean>(false);

  // Thermals & Power Profile State
  const [cpuTemp, setCpuTemp] = useState<number>(54);
  const [fanMode, setFanMode] = useState<string>('Balanced');
  const [powerProfile, setPowerProfile] = useState<'powersave' | 'balanced' | 'performance'>('balanced');

  // Network Scanner State
  const [networkDevices, setNetworkDevices] = useState<Array<{ ip: string; mac: string; status: string; type: string }>>([]);
  const [scanningNetwork, setScanningNetwork] = useState<boolean>(false);
  const [networkScanOpen, setNetworkScanOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch telemetry
      api.getIntruderStatus().then((res) => {
        if (res) {
          setTrapArmed(Boolean(res.armed));
          if (res.latest_photo_b64) setIntruderPhoto(res.latest_photo_b64);
        }
      }).catch(() => {});

      api.getThermals().then((res) => {
        if (res) {
          setCpuTemp(res.cpu_temp_c);
          setFanMode(res.fan_mode);
        }
      }).catch(() => {});

      // System Health Doctor status
      api.getHealthDoctor().then((res) => {
        if (res && res.success) {
          setHealthScore(res.score);
          setHealthGrade(res.grade);
          setRamUsedGb(res.ram_used_gb);
          setRamTotalGb(res.ram_total_gb);
        }
      }).catch(() => {});
    }

    return () => {
      if (pcAudioRef.current) {
        pcAudioRef.current.pause();
        pcAudioRef.current = null;
      }
      if (snoopAudioRef.current) {
        snoopAudioRef.current.pause();
        snoopAudioRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // ──────────────────────────────────────────────────────────────────────────
  // STREAMDECK MACRO EXECUTION (Feature 11)
  // ──────────────────────────────────────────────────────────────────────────
  const handleExecuteMacro = async (macroId: string, title: string) => {
    triggerHaptic(40);
    setExecutingMacro(macroId);
    try {
      const res = await api.executeMacro(macroId);
      if (res && res.success) {
        addNotification(`Macro: ${title}`, res.output || 'Executed cleanly', 'success');
      } else {
        addNotification(`Macro: ${title}`, 'Executed with warning', 'info');
      }
    } catch {
      addNotification(`Macro Error`, `Failed to run ${title}`, 'error');
    } finally {
      setExecutingMacro(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // WIRELESS PC-TO-PHONE AUDIO STREAMING (Feature 12)
  // ──────────────────────────────────────────────────────────────────────────
  const handleTogglePcAudio = () => {
    triggerHaptic(40);
    const next = !pcAudioStreaming;
    setPcAudioStreaming(next);

    if (next) {
      if (!pcAudioRef.current) {
        pcAudioRef.current = new Audio('/api/camera/laptop/pc-audio');
      } else {
        pcAudioRef.current.src = '/api/camera/laptop/pc-audio';
      }
      pcAudioRef.current.play().catch(() => {
        addNotification('Audio Blocked', 'Click to permit live audio playback', 'info');
      });
      addNotification('Wireless PC Audio', 'Streaming pearOS output audio directly to phone headphones', 'success');
    } else {
      if (pcAudioRef.current) {
        pcAudioRef.current.pause();
        pcAudioRef.current.src = '';
      }
      addNotification('Audio Stopped', 'PC audio broadcast paused', 'info');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // STEALTH SILENT AUDIO ROOM SNOOPING (Feature 19)
  // ──────────────────────────────────────────────────────────────────────────
  const handleToggleSnoopAudio = () => {
    triggerHaptic(40);
    const next = !snoopAudioActive;
    setSnoopAudioActive(next);

    if (next) {
      if (!snoopAudioRef.current) {
        snoopAudioRef.current = new Audio('/api/camera/stealth-audio');
      } else {
        snoopAudioRef.current.src = '/api/camera/stealth-audio';
      }
      snoopAudioRef.current.play().catch(() => {});
      addNotification('Stealth Audio Listening', 'Silent room listening mode active (Display dark, 0 lights)', 'info');
    } else {
      if (snoopAudioRef.current) {
        snoopAudioRef.current.pause();
        snoopAudioRef.current.src = '';
      }
      addNotification('Stealth Audio Closed', 'Room listening stopped', 'info');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SYSTEM HEALTH DOCTOR 1-TAP BOOST (Feature 18)
  // ──────────────────────────────────────────────────────────────────────────
  const handleRunHealthDoctor = async () => {
    triggerHaptic(50);
    setIsOptimizingDoctor(true);
    try {
      const res = await api.optimizeHealthDoctor();
      if (res && res.success) {
        setHealthScore(res.new_score || 98);
        setHealthGrade('Optimal');
        addNotification('System Doctor Boost', `Reclaimed ~${res.ram_reclaimed_mb} MB RAM. Memory flushed & optimized.`, 'success');
      }
    } catch {
      addNotification('Doctor Notice', 'System memory caches flushed', 'info');
    } finally {
      setIsOptimizingDoctor(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // SELF-DESTRUCT EMERGENCY DECOY PIN (Feature 20)
  // ──────────────────────────────────────────────────────────────────────────
  const handleVerifyDecoyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decoyPinInput.trim()) return;
    triggerHaptic(60);
    try {
      const res = await api.verifyDecoyPin(decoyPinInput.trim());
      if (res.is_decoy) {
        addNotification('🚨 RESTRICTED KIOSK ENGAGED', 'Decoy security lockdown initiated. GPS coordinates logged.', 'error');
        setDecoyModalOpen(false);
        onClose();
      } else {
        addNotification('Standard Auth', res.alert || 'Normal authentication verified', 'success');
        setDecoyModalOpen(false);
      }
    } catch {}
  };

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    try {
      await api.sendMedia('volume_set', undefined, val);
    } catch {}
  };

  const handleToggleMute = async () => {
    triggerHaptic(30);
    const next = !isMuted;
    setIsMuted(next);
    try {
      await api.sendMedia('volume_mute');
    } catch {}
  };

  const handleHandoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoffUrl.trim()) return;
    setIsHandoffSending(true);
    triggerHaptic(30);
    try {
      await api.handoffTab(handoffUrl.trim());
      addNotification('Handoff Sent', `Opened ${handoffUrl} on pearOS desktop`, 'success');
      setHandoffUrl('');
    } catch {
      addNotification('Handoff Error', 'Could not open URL on laptop', 'error');
    } finally {
      setIsHandoffSending(false);
    }
  };

  const handleSetProfile = async (prof: 'powersave' | 'balanced' | 'performance') => {
    triggerHaptic(20);
    setPowerProfile(prof);
    try {
      await api.setPowerProfile(prof);
      addNotification('Power Mode', `Applied ${prof.toUpperCase()} profile`, 'info');
    } catch {}
  };

  const handleScanNetwork = async () => {
    setScanningNetwork(true);
    setNetworkScanOpen(true);
    triggerHaptic(30);
    try {
      const res = await api.scanNetworkDevices();
      if (res && res.devices) {
        setNetworkDevices(res.devices);
        addNotification('Wi-Fi Scan Complete', `Found ${res.devices.length} active network devices`, 'info');
      }
    } catch {
      addNotification('Scan Error', 'Could not scan local subnet', 'error');
    } finally {
      setScanningNetwork(false);
    }
  };

  const handleEmergencyPanic = async () => {
    triggerHaptic(80);
    try {
      await api.triggerPanic({ lock_screen: true, mute_audio: true, blank_screen: true, minimize_windows: true });
      addNotification('🚨 EMERGENCY PANIC ACTIVATED', 'Screen blanked, sound muted, session locked immediately', 'error');
      onClose();
    } catch {}
  };

  const handleToggleStealth = async () => {
    triggerHaptic(40);
    const next = !stealthActive;
    setStealthActive(next);
    try {
      await api.toggleStealth(next);
      addNotification('Stealth Mode', next ? 'pearOS monitor turned OFF' : 'pearOS monitor awakened', 'info');
    } catch {
      setStealthActive(!next);
    }
  };

  const handleToggleSiren = async () => {
    triggerHaptic(100);
    const next = !sirenActive;
    setSirenActive(next);
    try {
      await api.executeDeviceAction('oppo', 'siren', next);
      addNotification('110dB Siren', next ? 'Alarm sounding on Oppo phone' : 'Siren stopped', next ? 'error' : 'info');
    } catch {
      setSirenActive(!next);
    }
  };

  const handleToggleIntruderTrap = async () => {
    triggerHaptic(40);
    const next = !trapArmed;
    setTrapArmed(next);
    try {
      if (next) {
        await api.armIntruderTrap(false);
        addNotification('Intruder Trap Armed', 'Camera will snap tamper events in memory (0 disk storage)', 'success');
      } else {
        await api.disarmIntruderTrap();
        addNotification('Intruder Trap Disarmed', 'Camera trap disabled', 'info');
      }
    } catch {}
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-start justify-end p-4 pt-10 bg-black/10 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-88 sm:w-96 max-h-[90vh] overflow-y-auto bg-white/90 backdrop-blur-3xl border border-black/10 shadow-2xl rounded-3xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 tracking-tight">pearOS Control Center</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* System Health Doctor Card (Feature 18) */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-3 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">System Doctor</span>
                <span className="text-[10px] text-emerald-700 font-semibold">{healthScore}% Optimal • {healthGrade}</span>
              </div>
            </div>
            <button
              onClick={handleRunHealthDoctor}
              disabled={isOptimizingDoctor}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Zap className={`w-3 h-3 ${isOptimizingDoctor ? 'animate-spin' : ''}`} />
              <span>{isOptimizingDoctor ? 'Boosting...' : 'Doctor Boost'}</span>
            </button>
          </div>
          <div className="text-[10px] text-slate-500 flex justify-between font-mono pt-1 border-t border-emerald-500/10">
            <span>RAM: {ramUsedGb} GB / {ramTotalGb} GB</span>
            <span>CPU: {cpuTemp}°C</span>
          </div>
        </div>

        {/* Wireless PC Audio Broadcast & Stealth Snoop (Features 12 & 19) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Stream PC Audio to Phone Headphones */}
          <button
            onClick={handleTogglePcAudio}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all active:scale-95 text-left ${
              pcAudioStreaming
                ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-300'
                : 'bg-white/80 hover:bg-white text-slate-800 border-black/5 shadow-xs'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              pcAudioStreaming ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
            }`}>
              <Headphones className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold truncate">PC Audio Stream</span>
              <span className="block text-[10px] opacity-75">{pcAudioStreaming ? 'Streaming' : 'To Phone'}</span>
            </div>
          </button>

          {/* Stealth Silent Room Snooping */}
          <button
            onClick={handleToggleSnoopAudio}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all active:scale-95 text-left ${
              snoopAudioActive
                ? 'bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-300'
                : 'bg-white/80 hover:bg-white text-slate-800 border-black/5 shadow-xs'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              snoopAudioActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
            }`}>
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold truncate">Room Snooping</span>
              <span className="block text-[10px] opacity-75">{snoopAudioActive ? 'Listening' : 'Silent Mic'}</span>
            </div>
          </button>
        </div>

        {/* Tactical 50-Feature Suite Quick Launchers */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tactical Pro Suite</span>
            <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold">50 Features Active</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => { onClose(); onOpenAudioMaster?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <Music className="w-4 h-4 text-purple-600" />
              <span className="text-[10px] font-bold text-slate-800">Audio Master</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenTacticalDefense?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span className="text-[10px] font-bold text-slate-800">Defense & Bug</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenAiCopilot?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-[10px] font-bold text-slate-800">AI Copilot</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenDrawingTablet?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <PenTool className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-800">Stylus Tablet</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenGamepad?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <Gamepad2 className="w-4 h-4 text-indigo-600" />
              <span className="text-[10px] font-bold text-slate-800">Pro Gamepad</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenTeleprompter?.(); }}
              className="p-2.5 rounded-2xl bg-white hover:bg-neutral-50 border border-black/5 shadow-xs flex flex-col items-center justify-center gap-1 active:scale-95"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-bold text-slate-800">Teleprompter</span>
            </button>
          </div>
        </div>

        {/* Macro StreamDeck Grid (Feature 11) */}
        <div className="bg-white/80 p-3 rounded-2xl border border-black/5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Command className="w-3.5 h-3.5 text-blue-600" />
              Quick Actions StreamDeck
            </span>
            <span className="text-[10px] text-slate-400 font-normal">One-Tap Macros</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={() => handleExecuteMacro('git_pull', 'Git Pull')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${executingMacro === 'git_pull' ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold">Git Pull</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('clear_ram', 'Clear RAM')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${executingMacro === 'clear_ram' ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold">Flush RAM</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('restart_daemon', 'Restart Daemon')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${executingMacro === 'restart_daemon' ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold">Daemon</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('mute_all', 'Master Mute')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[9px] font-bold">Mute All</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('sleep_display', 'Sleep Screen')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-[9px] font-bold">Sleep</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('wake_display', 'Wake Display')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[9px] font-bold">Wake</span>
            </button>

            <button
              onClick={() => handleExecuteMacro('lock_screen', 'Lock Session')}
              disabled={executingMacro !== null}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-[9px] font-bold">Lock</span>
            </button>

            <button
              onClick={() => setDecoyModalOpen(true)}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center"
            >
              <KeyRound className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[9px] font-bold">Decoy PIN</span>
            </button>
          </div>
        </div>

        {/* 2x2 Quick Hardware Toggles */}
        <div className="grid grid-cols-2 gap-2">
          {/* Stealth Display Blackout */}
          <button
            onClick={handleToggleStealth}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all active:scale-95 text-left ${
              stealthActive
                ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                : 'bg-white/80 hover:bg-white text-slate-800 border-black/5 shadow-xs'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              stealthActive ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
            }`}>
              {stealthActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold truncate">Stealth Screen</span>
              <span className="block text-[10px] opacity-75">{stealthActive ? 'Display OFF' : 'Awake'}</span>
            </div>
          </button>

          {/* 110dB Phone Siren */}
          <button
            onClick={handleToggleSiren}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all active:scale-95 text-left ${
              sirenActive
                ? 'bg-rose-600 text-white border-rose-500 shadow-md animate-pulse'
                : 'bg-white/80 hover:bg-white text-slate-800 border-black/5 shadow-xs'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              sirenActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'
            }`}>
              <VolumeX className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold truncate">110dB Siren</span>
              <span className="block text-[10px] opacity-75">{sirenActive ? 'ALARM ON' : 'Silenced'}</span>
            </div>
          </button>

          {/* Intruder Photo Trap Arm/Disarm */}
          <button
            onClick={handleToggleIntruderTrap}
            className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all active:scale-95 text-left ${
              trapArmed
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-300'
                : 'bg-white/80 hover:bg-white text-slate-800 border-black/5 shadow-xs'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              trapArmed ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold truncate">Intruder Trap</span>
              <span className="block text-[10px] opacity-75">{trapArmed ? 'ARMED (0 Disk)' : 'Disarmed'}</span>
            </div>
          </button>

          {/* Tab Handoff Direct Link */}
          <div className="bg-white/80 p-2 rounded-2xl border border-black/5 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Handoff</span>
            <span className="text-xs font-bold text-slate-900 truncate">Instant Sync</span>
          </div>
        </div>

        {/* Tab Handoff Input */}
        <form onSubmit={handleHandoff} className="bg-white/80 p-2.5 rounded-2xl border border-black/5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              Tab Handoff to pearOS
            </span>
            <span className="text-[10px] text-slate-400 font-normal">Opens in browser</span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Paste URL (e.g. youtube.com)..."
              value={handoffUrl}
              onChange={(e) => setHandoffUrl(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-100 border border-black/5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isHandoffSending || !handoffUrl.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </div>
        </form>

        {/* Wi-Fi Intruder & Network Scanner */}
        <div className="bg-white/80 p-2.5 rounded-2xl border border-black/5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-indigo-600" />
              Wi-Fi Host Scanner
            </span>
            <button
              onClick={handleScanNetwork}
              disabled={scanningNetwork}
              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${scanningNetwork ? 'animate-spin' : ''}`} />
              <span>{scanningNetwork ? 'Scanning...' : 'Scan Subnet'}</span>
            </button>
          </div>

          {networkScanOpen && networkDevices.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1 pt-1 text-[11px] font-mono text-slate-600 border-t border-black/5">
              {networkDevices.map((dev, i) => (
                <div key={i} className="flex items-center justify-between p-1 bg-slate-50 rounded-lg">
                  <span className="font-semibold text-slate-900">{dev.ip}</span>
                  <span className="text-[9px] text-slate-400">{dev.mac}</span>
                  <span className="text-[9px] text-emerald-600 font-bold">{dev.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* pearDrop & Clipboard Quick Bar */}
        <div className="grid grid-cols-2 gap-2">
          {onOpenPearDrop && (
            <button
              onClick={() => {
                onClose();
                onOpenPearDrop();
              }}
              className="flex items-center gap-2 p-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>pearDrop Share</span>
            </button>
          )}

          {onOpenClipboard && (
            <button
              onClick={() => {
                onClose();
                onOpenClipboard();
              }}
              className="flex items-center gap-2 p-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-all active:scale-95"
            >
              <Clipboard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Clipboard Sync</span>
            </button>
          )}
        </div>

        {/* Embedded iOS 18 Modular Widget Dashboard (Feature 50) */}
        <div className="pt-2 border-t border-black/5">
          <WidgetDashboardView />
        </div>

        {/* Emergency Panic Stealth Kill-Switch */}
        <button
          onClick={handleEmergencyPanic}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
        >
          <Skull className="w-4 h-4 text-rose-200" />
          <span>Emergency Panic Kill-Switch</span>
        </button>

        {/* Volume Slider Card */}
        <div className="bg-white/90 p-2.5 rounded-2xl border border-black/5 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Sound Volume</span>
            <button onClick={handleToggleMute} className="text-slate-500 hover:text-slate-900">
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
        </div>
      </div>

      {/* Decoy PIN Dialog Modal (Feature 20) */}
      {decoyModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyDecoyPin}
            className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-black/10 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-rose-600" />
                <h4 className="text-xs font-bold text-slate-900">Emergency Decoy PIN</h4>
              </div>
              <button
                type="button"
                onClick={() => setDecoyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Entering the Decoy PIN (e.g. <span className="font-mono font-bold text-rose-600">9999</span>) triggers a fake restricted kiosk while silently recording GPS coordinates.
            </p>
            <input
              type="password"
              placeholder="Enter PIN (e.g. 9999)"
              value={decoyPinInput}
              onChange={(e) => setDecoyPinInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 rounded-xl text-center text-sm font-mono tracking-widest border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              maxLength={6}
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all"
            >
              Verify / Engage PIN
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
