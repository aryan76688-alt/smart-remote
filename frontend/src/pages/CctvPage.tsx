import React, { useState, useEffect, useRef } from 'react';
import {
  Video, ShieldAlert, Volume2, VolumeX, Moon, Sun, Maximize2, Minimize2, Camera,
  RefreshCw, CheckCircle2, AlertTriangle, Cloud, Eye, Radio,
  Bell, BellOff, ArrowDownToLine, Play, X, ExternalLink, Smartphone,
  Ruler, User, UserCheck, Crosshair, Scan, Mic, MicOff, MessageSquare, Waves, Sparkles,
  PictureInPicture
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { CctvVideoPlayerModal } from '../components/cctv/CctvVideoPlayerModal';
import { SirenModal } from '../components/intercom/SirenModal';

export const CctvPage: React.FC = () => {
  const { isApk, triggerHaptic, registerBackHandler, enterPiP } = useApp();
  const [cctvStatus, setCctvStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [cloudRecordings, setCloudRecordings] = useState<any[]>([]);
  const [recordingsTab, setRecordingsTab] = useState<'cloud' | 'local'>('cloud');
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Video & Audio Player state
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [audioVolume, setAudioVolume] = useState<number>(1.0);
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);
  const [sirenEnabled, setSirenEnabled] = useState<boolean>(false);
  const [showSirenModal, setShowSirenModal] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Mobile Device Vibration state
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true);
  const [isVibrating, setIsVibrating] = useState<boolean>(false);
  const lastVibrateRef = useRef<number>(0);

  // Trigger tactile mobile vibration alarm when motion detected
  const triggerMotionVibration = () => {
    if (!vibrationEnabled) return;
    const now = Date.now();
    if (now - lastVibrateRef.current < 2500) return; // 2.5s cooldown
    lastVibrateRef.current = now;

    try {
      setIsVibrating(true);
      triggerHaptic(400);
      setTimeout(() => setIsVibrating(false), 1200);
    } catch {
      // Ignore vibration error
    }
  };

  const handleTestVibrate = () => {
    try {
      setIsVibrating(true);
      triggerHaptic(200);
      setTimeout(() => setIsVibrating(false), 500);
    } catch {}
  };

  // Master Motion Detection toggle
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true);

  // Camera Auto-Adjust Lighting toggle (Requirement)
  const [autoLightAdjust, setAutoLightAdjust] = useState<boolean>(true);

  const handleToggleAutoLight = async () => {
    const nextVal = !autoLightAdjust;
    setAutoLightAdjust(nextVal);
    try {
      await api.toggleAutoLightAdjust(nextVal);
    } catch {
      setAutoLightAdjust(!nextVal);
    }
  };

  // Two-Way Mobile -> Laptop Speaker Intercom
  const [isIntercomRecording, setIsIntercomRecording] = useState<boolean>(false);
  const [intercomStatus, setIntercomStatus] = useState<string>('idle');
  const [intercomHistory, setIntercomHistory] = useState<any[]>([]);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const intercomStreamRef = useRef<MediaStream | null>(null);
  const isStartingIntercomRef = useRef<boolean>(false);
  const shouldStopAfterStartRef = useRef<boolean>(false);

  const startIntercom = async () => {
    if (isIntercomRecording || isStartingIntercomRef.current) return;
    isStartingIntercomRef.current = true;
    shouldStopAfterStartRef.current = false;
    audioChunksRef.current = [];

    // Check mediaDevices support and Secure Context (HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isStartingIntercomRef.current = false;
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setShowSecurityModal(true);
        return;
      }
      alert('Microphone access is not supported by your current browser context. Connect via HTTPS or Cloudflare Tunnel.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      intercomStreamRef.current = stream;

      // Abort if touch was already released before permission dialog resolved
      if (shouldStopAfterStartRef.current) {
        stream.getTracks().forEach(t => t.stop());
        intercomStreamRef.current = null;
        isStartingIntercomRef.current = false;
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        intercomStreamRef.current = null;

        // Allow phrases of 150+ bytes
        if (audioBlob.size > 150) {
          setIntercomStatus('sending');
          try {
            const res = await api.sendIntercomAudio(audioBlob);
            if (res.success) {
              setIntercomStatus('played');
              setTimeout(() => setIntercomStatus('idle'), 3000);
              fetchData();
            } else {
              setIntercomStatus('error');
              setTimeout(() => setIntercomStatus('idle'), 3000);
            }
          } catch (err) {
            console.error('Failed to send intercom audio:', err);
            setIntercomStatus('error');
            setTimeout(() => setIntercomStatus('idle'), 3000);
          }
        } else {
          setIntercomStatus('idle');
        }
      };

      recorder.start(100);
      setIsIntercomRecording(true);
      setIntercomStatus('recording');
    } catch (err) {
      console.error('Microphone permission denied or unavailable:', err);
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setShowSecurityModal(true);
      } else {
        alert('Microphone access is required to speak to laptop speakers.');
      }
      setIsIntercomRecording(false);
      setIntercomStatus('idle');
    } finally {
      isStartingIntercomRef.current = false;
    }
  };

  const stopIntercom = () => {
    if (isStartingIntercomRef.current) {
      shouldStopAfterStartRef.current = true;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsIntercomRecording(false);
  };

  const toggleIntercom = () => {
    if (isIntercomRecording || isStartingIntercomRef.current) {
      stopIntercom();
    } else {
      startIntercom();
    }
  };

  const handleToggleMotion = async () => {
    const nextVal = !motionEnabled;
    setMotionEnabled(nextVal);
    try {
      await api.toggleMotionDetection(nextVal);
    } catch {
      setMotionEnabled(!nextVal);
    }
  };

  const startAudioPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioEnabled(true);
    const targetUrl = `/api/camera/laptop/audio?t=${Date.now()}`;
    if (!audio.src || audio.paused || audio.ended) {
      audio.src = targetUrl;
    }
    audio.volume = audioVolume;
    audio.play()
      .then(() => {
        setAudioPlaying(true);
        setAudioBlocked(false);
      })
      .catch((err) => {
        console.warn('Audio playback blocked by browser policy:', err);
        setAudioBlocked(true);
        setAudioPlaying(false);
      });
  };

  const handleToggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (next) {
      startAudioPlayback();
    } else {
      audio.pause();
      audio.src = '';
      setAudioPlaying(false);
      setAudioBlocked(false);
    }
  };

  // Continuous gesture listener to unlock audio autoplay on mobile
  useEffect(() => {
    if (!audioEnabled || audioPlaying) return;

    const unlockAudio = () => {
      if (audioEnabled && audioRef.current && (audioRef.current.paused || !audioPlaying)) {
        startAudioPlayback();
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [audioEnabled, audioPlaying, audioVolume]);

  // Screen Stealth state
  const [screenIsOff, setScreenIsOff] = useState<boolean>(true);
  const [keepScreenOff, setKeepScreenOff] = useState<boolean>(true);

  // Selected snapshot modal preview
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  // Fullscreen CCTV surveillance state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullScreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          (document.documentElement as any).webkitRequestFullscreen();
        }
      } catch {}
    } else {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitFullscreenElement) {
          (document as any).webkitExitFullscreen();
        }
      } catch {}
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isNativeFs && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Mobile Back Button integration for CCTV overlays and Fullscreen
  useEffect(() => {
    if (!isFullscreen && !selectedSnapshot && !showSecurityModal && !selectedVideoForPlayer) return;
    return registerBackHandler(() => {
      if (selectedVideoForPlayer) {
        setSelectedVideoForPlayer(null);
        return true;
      }
      if (isFullscreen) {
        setIsFullscreen(false);
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        return true;
      }
      if (selectedSnapshot) {
        setSelectedSnapshot(null);
        return true;
      }
      if (showSecurityModal) {
        setShowSecurityModal(false);
        return true;
      }
      return false;
    });
  }, [isFullscreen, selectedSnapshot, showSecurityModal, selectedVideoForPlayer, registerBackHandler]);

  // Siren audio synthesizer ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSirenPlayRef = useRef<number>(0);

  // Play synthetic alert chime on phone when motion detected
  const triggerMotionSiren = () => {
    if (!sirenEnabled) return;
    const now = Date.now();
    if (now - lastSirenPlayRef.current < 4000) return; // 4s cooldown
    lastSirenPlayRef.current = now;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context error
    }
  };

  const fetchData = async () => {
    try {
      const [statusRes, settingsRes, eventsRes, recsRes, cloudRecsRes, intercomRes] = await Promise.all([
        api.getCctvStatus(),
        api.getCctvSettings(),
        api.getCctvEvents(),
        api.getCctvRecordings(),
        api.getCloudRecordings().catch(() => []),
        api.getIntercomHistory().catch(() => [])
      ]);
      setCctvStatus(statusRes);
      setSettings(settingsRes);
      setEvents(eventsRes || []);
      setRecordings(recsRes || []);
      setCloudRecordings(cloudRecsRes || []);
      setIntercomHistory(intercomRes || []);
      if (statusRes) {
        setNightMode(Boolean(statusRes.night_mode));
        setScreenIsOff(Boolean(statusRes.screen_is_off));
        setKeepScreenOff(statusRes.keep_laptop_screen_off !== false);
        setMotionEnabled(statusRes.motion_detection_enabled !== false);
        if (statusRes.auto_light_adjust !== undefined) {
          setAutoLightAdjust(Boolean(statusRes.auto_light_adjust));
        }
        if (statusRes.motion_detected && statusRes.motion_detection_enabled !== false) {
          triggerMotionSiren();
          triggerMotionVibration();
        }
      }
    } catch (err) {
      console.error('Failed to fetch CCTV telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [sirenEnabled, vibrationEnabled]);

  // Handle Audio Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  const handleToggleNightMode = async () => {
    const nextVal = !nightMode;
    setNightMode(nextVal);
    try {
      await api.updateCctvSettings({ night_mode: nextVal });
    } catch {
      setNightMode(!nextVal);
    }
  };

  const handleSetSensitivity = async (level: string) => {
    setActionLoading(`sens_${level}`);
    try {
      await api.updateCctvSettings({ motion_sensitivity: level });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleTurnScreenOff = async () => {
    setActionLoading('screen_off');
    try {
      const res = await api.turnCctvScreenOff();
      if (res.success) {
        setScreenIsOff(true);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleWakeScreen = async () => {
    setActionLoading('screen_on');
    try {
      const res = await api.wakeCctvScreen();
      if (res.success) {
        setScreenIsOff(false);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleKeepScreenOff = async (enabled: boolean) => {
    setKeepScreenOff(enabled);
    try {
      await api.updateCctvSettings({ keep_laptop_screen_off: enabled });
      if (enabled) {
        await api.turnCctvScreenOff();
        setScreenIsOff(true);
      }
    } catch {
      setKeepScreenOff(!enabled);
    }
  };

  const handleSyncToDrive = async () => {
    setActionLoading('sync_drive');
    try {
      await api.syncAllCctvToDrive();
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const formatSecToTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const streamUrl = `/api/camera/laptop/stream?quality=80&fps=30&t=${nightMode ? 'n1' : 'n0'}&al=${autoLightAdjust ? 1 : 0}`;
  const audioStreamUrl = `/api/camera/laptop/audio`;

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-3 sm:p-5 space-y-4 pb-24 safe-bottom">
      {/* Live microphone audio element with explicit event handlers and auto-recovery */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onPlay={() => {
          setAudioPlaying(true);
          setAudioBlocked(false);
        }}
        onPause={() => {
          if (audioEnabled) {
            setAudioPlaying(false);
          }
        }}
        onError={() => {
          setAudioPlaying(false);
          setAudioBlocked(true);
          // Auto recover after momentary connection interruption
          if (audioEnabled) {
            setTimeout(() => {
              if (audioEnabled && audioRef.current) {
                startAudioPlayback();
              }
            }, 1500);
          }
        }}
        onStalled={() => {
          if (audioEnabled && audioRef.current) {
            setTimeout(() => {
              if (audioEnabled && audioRef.current && audioRef.current.paused) {
                audioRef.current.play().catch(() => {});
              }
            }, 1000);
          }
        }}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyber-surface/90 border border-cyber-border rounded-xl p-4 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold tracking-wide text-slate-100 uppercase font-mono">
                CCTV Command Station
              </h1>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>24/7 ACTIVE</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Kali Linux Laptop Webcam &amp; Microphone Surveillance Hub
            </p>
          </div>
        </div>

        {/* Rolling Chunk & Storage Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300">
            <span className="text-slate-400 text-[10px] block">CHUNK REMAINING</span>
            <span className="text-cyan-400 font-bold">
              {cctvStatus ? formatSecToTimer(cctvStatus.chunk_remaining_sec || 0) : '30:00'} / 30:00
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300">
            <span className="text-slate-400 text-[10px] block">RECORDINGS</span>
            <span className="text-emerald-400 font-bold">{recordings.length} Chunks</span>
          </div>

          <button
            onClick={handleSyncToDrive}
            disabled={actionLoading === 'sync_drive'}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold transition-all disabled:opacity-50"
          >
            <Cloud className={`w-3.5 h-3.5 ${actionLoading === 'sync_drive' ? 'animate-spin' : ''}`} />
            <span>{actionLoading === 'sync_drive' ? 'SYNCING...' : 'SYNC DRIVE'}</span>
          </button>

          {!isApk && (
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 border border-cyan-400 text-cyan-200 font-bold transition-all active:scale-95 text-xs font-mono"
              title="Download Android APK"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>APP (.APK)</span>
            </a>
          )}

          <button
            onClick={() => {
              triggerHaptic(50);
              setShowSirenModal(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 border border-rose-500/60 text-rose-300 font-bold transition-all active:scale-95 shadow-md shadow-rose-950/50 animate-pulse"
            title="Emergency Siren (100% Volume) & Push-to-Talk Intercom"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>🚨 SIREN &amp; INTERCOM</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(30);
              enterPiP();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold transition-all active:scale-95"
            title="Floating Picture-in-Picture Mode"
          >
            <PictureInPicture className="w-3.5 h-3.5" />
            <span>PIP</span>
          </button>

          <button
            onClick={toggleFullScreen}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold transition-all active:scale-95"
            title="Open Fullscreen Surveillance Monitor"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>FULLSCREEN</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CCTV Video Monitor (Col 1 & 2) */}
        <div className="lg:col-span-2 space-y-3">
          <div
            id="cctv-video-container"
            className={`transition-all select-none ${
              isFullscreen
                ? 'fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden p-0 m-0 w-screen h-screen'
                : 'relative rounded-2xl overflow-hidden bg-black border border-cyber-border shadow-2xl aspect-video flex items-center justify-center group'
            }`}
          >
            {/* Live MJPEG Stream */}
            <img
              src={streamUrl}
              alt="Kali Laptop CCTV Stream"
              onDoubleClick={toggleFullScreen}
              className={`w-full h-full object-contain ${
                isFullscreen ? 'max-h-screen max-w-screen' : ''
              }`}
            />

            {/* Top-Right Dedicated Floating Fullscreen Button */}
            <button
              onClick={toggleFullScreen}
              className={`absolute top-3 right-3 z-40 px-3 py-1.5 rounded-xl font-mono text-xs font-black tracking-wider flex items-center space-x-1.5 shadow-2xl transition-all active:scale-95 border ${
                isFullscreen
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-900/60'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-cyan-500/40'
              }`}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen CCTV'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>EXIT FULLSCREEN</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>FULL-SCREEN</span>
                </>
              )}
            </button>

            {/* Mobile Autoplay Unmute Floating Banner */}
            {audioEnabled && !audioPlaying && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAudioPlayback();
                }}
                className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-black tracking-wider flex items-center space-x-2 shadow-2xl shadow-cyan-500/50 border border-cyan-300 animate-bounce active:scale-95 pointer-events-auto"
                title="Tap to hear live laptop audio"
              >
                <Volume2 className="w-4 h-4 animate-ping" />
                <span>TAP TO HEAR LAPTOP AUDIO</span>
              </button>
            )}

            {/* Overlaid Vibration Alert Banner */}
            {isVibrating && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 rounded-full bg-cyan-500/90 border border-cyan-300 text-slate-950 font-mono text-xs font-black tracking-wider flex items-center space-x-1.5 animate-pulse shadow-lg shadow-cyan-500/50">
                <Smartphone className="w-4 h-4 animate-bounce" />
                <span>MOBILE VIBRATING</span>
              </div>
            )}

            {/* Overlaid Motion Alert Banner */}
            {cctvStatus?.motion_detected && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-600/90 border border-rose-400 text-white font-mono text-xs font-bold tracking-wider flex items-center space-x-2 animate-bounce shadow-lg shadow-rose-900/50">
                <AlertTriangle className="w-4 h-4" />
                <span>MOTION DETECTED [{cctvStatus.motion_score || 0}%]</span>
              </div>
            )}

            {/* Target Boxes Legend Overlay */}
            {cctvStatus?.motion_boxes && cctvStatus.motion_boxes.length > 0 && (
              <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md border border-cyan-500/50 rounded-xl p-2 font-mono text-cyan-300 shadow-xl max-w-[280px] space-y-1.5 pointer-events-none z-10">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-1">
                  <span className="text-cyan-300 font-bold text-[10px] flex items-center space-x-1">
                    <Scan className="w-3 h-3 text-cyan-400" />
                    <span>AI TARGETS ({cctvStatus.motion_boxes.length})</span>
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold px-1.5 py-0.2 bg-emerald-500/20 rounded border border-emerald-500/40">TRACKING</span>
                </div>
                {cctvStatus.motion_boxes.slice(0, 2).map((b: any) => (
                  <div key={b.id} className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white font-bold flex items-center space-x-1 truncate">
                        <User className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                        <span>#{b.id} {b.ai_name || (b.is_human ? 'Human' : 'Target')}</span>
                      </span>
                      <span className="text-emerald-400 text-[9px] shrink-0 font-mono">
                        {b.score}%
                      </span>
                    </div>
                    {b.height_cm && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="flex items-center space-x-1">
                          <Ruler className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="font-bold text-amber-300">↕ {b.height_cm}cm ({b.height_imperial})</span>
                        </span>
                        <span className="text-slate-400 text-[9px]">~{b.distance_m || 1.0}m</span>
                      </div>
                    )}
                    <div className="text-[9px] text-slate-400 truncate">
                      {b.posture || 'Detected'} • Age ~{b.ai_age || 25} • {b.ai_mood || 'Active'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Stream HUD Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between text-xs font-mono text-white">
              <div className="flex items-center space-x-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] text-slate-200">1280x720 @ 30FPS</span>
                {audioPlaying && (
                  <span className="hidden sm:flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Volume2 className="w-2.5 h-2.5" />
                    <span>AUDIO LIVE</span>
                  </span>
                )}
              </div>

            {/* Overlaid Intercom Broadcast Banner */}
            {isIntercomRecording && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-rose-600 border-2 border-white text-white font-mono text-xs font-black tracking-wider flex items-center space-x-2 animate-pulse shadow-2xl shadow-rose-950">
                <Mic className="w-4 h-4 animate-bounce" />
                <span>TALKING TO LAPTOP SPEAKERS...</span>
              </div>
            )}

            {/* In-Stream Action Buttons */}
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {/* Push-to-Talk / Tap-to-Talk Intercom Button */}
              <button
                onClick={toggleIntercom}
                onMouseDown={startIntercom}
                onMouseUp={stopIntercom}
                onTouchStart={startIntercom}
                onTouchEnd={stopIntercom}
                onContextMenu={(e) => e.preventDefault()}
                className={`px-3 py-1 rounded border text-[10px] font-bold flex items-center space-x-1.5 transition-all select-none active:scale-95 ${
                  isIntercomRecording
                    ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-lg shadow-rose-600/50'
                    : intercomStatus === 'sending'
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300 animate-pulse'
                    : intercomStatus === 'played'
                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                    : 'bg-gradient-to-r from-rose-500/30 to-purple-500/30 border-rose-400/60 text-rose-200 hover:text-white'
                }`}
                title="Tap once or hold to speak into mobile and broadcast on Kali laptop speakers"
              >
                <Mic className={`w-3.5 h-3.5 ${isIntercomRecording ? 'animate-bounce' : ''}`} />
                <span>
                  {isIntercomRecording
                    ? 'REC (TAP TO SEND)'
                    : intercomStatus === 'sending'
                    ? 'SENDING...'
                    : intercomStatus === 'played'
                    ? 'PLAYED!'
                    : 'TALK TO LAPTOP'}
                </span>
              </button>

              {/* Motion Detection ON/OFF toggle */}
              <button
                onClick={handleToggleMotion}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center space-x-1 transition-all ${
                  motionEnabled
                    ? 'bg-rose-500/30 border-rose-400 text-rose-300'
                    : 'bg-black/60 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle Motion Detection Engine ON/OFF"
              >
                <Radio className="w-3 h-3" />
                <span>{motionEnabled ? 'MOTION ON' : 'MOTION OFF'}</span>
              </button>

              {/* Auto Adjust Light ON/OFF toggle */}
              <button
                onClick={handleToggleAutoLight}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center space-x-1 transition-all ${
                  autoLightAdjust
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-black/60 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle Intelligent Camera Auto-Adjust Lighting & Exposure Correction"
              >
                <Sun className="w-3 h-3" />
                <span>{autoLightAdjust ? 'AUTO LIGHT ON' : 'AUTO LIGHT OFF'}</span>
              </button>

              {/* Full Screen Toggle Button */}
              <button
                onClick={toggleFullScreen}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center space-x-1 transition-all ${
                  isFullscreen
                    ? 'bg-rose-600/30 border-rose-500 text-rose-300 hover:bg-rose-600/40'
                    : 'bg-cyan-500/30 border-cyan-400 text-cyan-300 hover:bg-cyan-500/40'
                }`}
                title={isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen'}
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span>{isFullscreen ? 'EXIT FS' : 'FULLSCREEN'}</span>
              </button>

              {/* Night Vision Button */}
              <button
                onClick={handleToggleNightMode}
                  className={`px-2.5 py-1 rounded border text-[10px] flex items-center space-x-1 transition-all ${
                    nightMode
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-black/60 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Toggle Digital IR Night Vision (Noise Cleaned + CLAHE Boost)"
                >
                  <Moon className="w-3 h-3" />
                  <span>{nightMode ? 'IR NIGHT ON' : 'IR NIGHT'}</span>
                </button>

                {/* Audio Toggle */}
                <button
                  onClick={handleToggleAudio}
                  className={`px-2.5 py-1 rounded border text-[10px] flex items-center space-x-1 transition-all ${
                    audioEnabled && audioPlaying
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300 font-bold'
                      : audioEnabled && !audioPlaying
                      ? 'bg-amber-500/30 border-amber-400 text-amber-300 animate-pulse font-bold'
                      : 'bg-black/60 border-slate-700 text-slate-400'
                  }`}
                  title={audioPlaying ? 'Microphone Active (Tap to Mute)' : 'Microphone Inactive / Tap to Play'}
                >
                  {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  <span>{audioEnabled ? (audioPlaying ? 'MIC LIVE' : 'UNMUTE MIC') : 'MUTED'}</span>
                </button>

                {/* Snapshot Capture */}
                <a
                  href="/api/camera/laptop/snapshot"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded border border-slate-700 bg-black/60 text-slate-300 hover:text-white text-[10px] flex items-center space-x-1"
                  title="Open Instant Photo Snapshot"
                >
                  <Camera className="w-3 h-3" />
                  <span>PHOTO</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Audio Volume Slider */}
          {audioEnabled && (
            <div className="flex items-center space-x-3 bg-cyber-surface/70 border border-cyber-border rounded-xl p-3 text-xs font-mono">
              <button
                onClick={handleToggleAudio}
                className="shrink-0 text-cyan-400 hover:text-white"
                title={audioPlaying ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {audioPlaying ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-amber-400" />}
              </button>
              <span className="text-slate-400 text-[11px] whitespace-nowrap">
                MIC {audioPlaying ? 'LIVE' : (audioBlocked ? 'BLOCKED (TAP)' : 'STANDBY')}:
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setAudioVolume(val);
                  if (audioRef.current) audioRef.current.volume = val;
                }}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-cyan-300 text-[11px] min-w-[3rem] text-right">
                {Math.round(audioVolume * 100)}%
              </span>
              {!audioPlaying && (
                <button
                  onClick={startAudioPlayback}
                  className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold"
                >
                  LISTEN
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Controls: Stealth Screen-Off & Advanced Motion (Col 3) */}
        <div className="space-y-4">
          {/* CARD 0: NOISE CANCELLATION & AUTO-ADJUST LIGHTING */}
          <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200">
                  Visual &amp; Light Intelligence
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                ACTIVE AI
              </span>
            </div>

            {/* Feature: Camera Auto-Adjust Lighting & Dynamic Exposure */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sun className={`w-4 h-4 ${autoLightAdjust ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-bold font-mono text-slate-200 block">Camera Auto-Adjust Light</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {autoLightAdjust ? 'Dynamic exposure + Gamma LUT + Backlight boost' : 'Raw sensor exposure'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoLight}
                  className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold border transition-all ${
                    autoLightAdjust
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/30'
                      : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {autoLightAdjust ? '● ON' : '○ OFF'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                Intelligently analyzes room luminance 30 times a second. Dynamically lifts dark shadows and backlit faces while preventing glare blowout with zero frame delay.
              </p>
            </div>
          </div>

          {/* CARD 1: LAPTOP SCREEN STEALTH POWER CONTROL (Requirement 3) */}
          <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Moon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200">
                  Screen Stealth Mode
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  screenIsOff
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {screenIsOff ? '🌙 SCREEN OFF' : '☀️ SCREEN ON'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Powers down the laptop monitor via hardware DPMS so the laptop appears completely sleeping while secretly recording 24/7 CCTV in the background.
            </p>

            {/* Quick Screen Off / Wake Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTurnScreenOff}
                disabled={actionLoading === 'screen_off'}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 text-xs font-bold font-mono transition-all disabled:opacity-50"
              >
                <Moon className="w-3.5 h-3.5 text-purple-300" />
                <span>{actionLoading === 'screen_off' ? 'TURNING OFF...' : 'SCREEN OFF'}</span>
              </button>

              <button
                onClick={handleWakeScreen}
                disabled={actionLoading === 'screen_on'}
                className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold font-mono transition-all disabled:opacity-50"
              >
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>{actionLoading === 'screen_on' ? 'WAKING...' : 'WAKE SCREEN'}</span>
              </button>
            </div>

            {/* Auto-enforce checkbox */}
            <label className="flex items-center space-x-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepScreenOff}
                onChange={e => handleToggleKeepScreenOff(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500 accent-purple-500"
              />
              <span className="text-[11px] text-slate-300 font-medium">
                Auto-keep laptop screen off during surveillance
              </span>
            </label>
          </div>

          {/* CARD 2: ADVANCED MOTION DETECTION COMMAND (Requirement 2) */}
          <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200">
                  Motion Intelligence
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleToggleMotion}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                    motionEnabled
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Master Motion Detection Toggle"
                >
                  {motionEnabled ? '● ON' : '○ OFF'}
                </button>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    cctvStatus?.motion_detected && motionEnabled
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {motionEnabled ? (cctvStatus?.motion_detected ? '🚨 DETECTED' : 'QUIET') : 'PAUSED'}
                </span>
              </div>
            </div>

            {/* Motion Score Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>MOTION ACTIVITY SCORE</span>
                <span className="text-cyan-400 font-bold">{cctvStatus?.motion_score || 0}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    (cctvStatus?.motion_score || 0) > 40
                      ? 'bg-rose-500'
                      : (cctvStatus?.motion_score || 0) > 15
                      ? 'bg-amber-400'
                      : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, cctvStatus?.motion_score || 0))}%` }}
                />
              </div>
            </div>

            {/* Sensitivity Tier Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-slate-400 block">SENSITIVITY PRESET:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'low', label: 'LOW', desc: 'Full Body' },
                  { id: 'medium', label: 'MED', desc: 'Standard' },
                  { id: 'high', label: 'HIGH', desc: 'Hand/Pet' },
                  { id: 'ultra', label: 'ULTRA', desc: 'Micro' }
                ].map(tier => {
                  const isCurrent = (settings?.motion_sensitivity || 'medium').toLowerCase() === tier.id;
                  return (
                    <button
                      key={tier.id}
                      onClick={() => handleSetSensitivity(tier.id)}
                      disabled={actionLoading === `sens_${tier.id}`}
                      className={`py-1.5 px-1 rounded-lg border text-center font-mono text-[10px] transition-all ${
                        isCurrent
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold">{tier.label}</div>
                      <div className="text-[8px] opacity-70 truncate">{tier.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Local Siren Alarm Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                {sirenEnabled ? (
                  <Bell className="w-4 h-4 text-rose-400 animate-bounce" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-[11px] text-slate-300 font-mono">Phone Alarm Chime</span>
              </div>
              <button
                onClick={() => setSirenEnabled(!sirenEnabled)}
                className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold border transition-all ${
                  sirenEnabled
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {sirenEnabled ? 'ARMED' : 'MUTED'}
              </button>
            </div>

            {/* Mobile Phone Vibration on Motion (Requirement) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <Smartphone className={`w-4 h-4 ${vibrationEnabled ? (isVibrating ? 'text-rose-400 animate-ping' : 'text-cyan-400') : 'text-slate-500'}`} />
                <div>
                  <span className="text-[11px] text-slate-300 font-mono block">Mobile Vibration</span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {isVibrating ? '📳 VIBRATING NOW' : (vibrationEnabled ? 'Vibrate phone on motion' : 'Disabled')}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={handleTestVibrate}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[9px] font-bold border border-slate-700 active:scale-95"
                  title="Test phone vibration"
                >
                  TEST
                </button>
                <button
                  onClick={() => setVibrationEnabled(!vibrationEnabled)}
                  className={`px-3 py-1 rounded-full font-mono text-[10px] font-bold border transition-all ${
                    vibrationEnabled
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {vibrationEnabled ? 'ARMED' : 'MUTED'}
                </button>
              </div>
            </div>
          </div>

          {/* CARD 3: AI BIOMETRICS & HUMAN HEIGHT ENGINE */}
          <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scan className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200">
                  AI Biometrics & Height
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  cctvStatus?.motion_boxes && cctvStatus.motion_boxes.some((b: any) => b.is_human)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {cctvStatus?.motion_boxes && cctvStatus.motion_boxes.some((b: any) => b.is_human)
                  ? '👤 HUMAN LOCKED'
                  : 'RADAR ACTIVE'}
              </span>
            </div>

            {/* Target telemetry list */}
            {cctvStatus?.motion_boxes && cctvStatus.motion_boxes.length > 0 ? (
              <div className="space-y-2.5">
                {cctvStatus.motion_boxes.map((b: any) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-all font-mono space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${b.is_human ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                          {b.is_human ? <User className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                            <span>#{b.id}</span>
                            <span>{b.ai_name || (b.is_human ? 'Human Body' : 'Target')}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 uppercase">
                            {b.body_type || (b.is_human ? 'HUMAN' : 'TARGET')} • ACTIVE {b.duration || 0}s
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {b.score}% CONF
                      </span>
                    </div>

                    {/* Height & Distance Measurement Display */}
                    <div className="grid grid-cols-2 gap-2 bg-black/50 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <div className="text-[9px] text-slate-400 flex items-center space-x-1">
                          <Ruler className="w-3 h-3 text-amber-400" />
                          <span>AI HEIGHT</span>
                        </div>
                        <div className="text-xs font-bold text-amber-300 pt-0.5">
                          {b.height_cm ? `${b.height_cm} cm` : '---'}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          {b.height_imperial || ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400">DISTANCE & POSTURE</div>
                        <div className="text-xs font-bold text-cyan-300 pt-0.5">
                          ~{b.distance_m ? `${b.distance_m}m` : '1.0m'}
                        </div>
                        <div className="text-[10px] text-emerald-300 truncate">
                          {b.posture || 'Detected'}
                        </div>
                      </div>
                    </div>

                    {/* Demographics / Mood telemetry */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Age: <strong className="text-slate-200">~{b.ai_age || 25} yrs</strong></span>
                      <span>Mood: <strong className="text-cyan-300">{b.ai_mood || 'Neutral'}</strong></span>
                      <span className="text-[9px] text-slate-500">Pinhole FOV 65°</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 px-3 bg-slate-900/40 rounded-xl border border-slate-800/60 font-mono text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-center pb-1">
                  <Scan className="w-5 h-5 text-cyan-400 animate-pulse" />
                </div>
                <div className="text-slate-300 font-bold">Scanning for Human Presence</div>
                <div className="text-[10px] text-slate-500">
                  Haar Cascade & Pinhole Geometry AI calculates human height, distance, posture, and facial identity in real-time.
                </div>
              </div>
            )}
          </div>

          {/* CARD 4: TWO-WAY VOICE INTERCOM (MOBILE -> LAPTOP SPEAKERS) */}
          <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-200">
                  Two-Way Voice Intercom
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isIntercomRecording
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : intercomStatus === 'sending'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                    : intercomStatus === 'played'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {isIntercomRecording
                  ? '🎙️ SPEAKING'
                  : intercomStatus === 'sending'
                  ? '⚡ SENDING...'
                  : intercomStatus === 'played'
                  ? '🔊 PLAYED!'
                  : '🔊 SPEAKERS READY'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              Hold or tap the button to speak into your phone. Your voice plays aloud through the laptop speakers in real-time and saves to Google Drive folder <span className="text-cyan-400 font-bold">Kali_CCTV_Recordings2.0</span>.
            </p>

            {/* Push-to-Talk Mic Button */}
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <button
                onClick={toggleIntercom}
                onMouseDown={startIntercom}
                onMouseUp={stopIntercom}
                onTouchStart={startIntercom}
                onTouchEnd={stopIntercom}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-full py-4 px-4 rounded-2xl font-mono text-xs font-black tracking-wider flex items-center justify-center space-x-3 transition-all select-none shadow-2xl active:scale-95 border-2 ${
                  isIntercomRecording
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-white animate-pulse shadow-rose-600/50'
                    : intercomStatus === 'sending'
                    ? 'bg-amber-600/40 text-amber-200 border-amber-400 animate-pulse'
                    : intercomStatus === 'played'
                    ? 'bg-emerald-600/40 text-emerald-200 border-emerald-400'
                    : 'bg-gradient-to-r from-rose-600/30 via-purple-600/30 to-cyan-600/30 hover:from-rose-600/40 hover:to-cyan-600/40 text-slate-100 border-rose-500/40 hover:border-rose-400'
                }`}
              >
                <Mic className={`w-5 h-5 ${isIntercomRecording ? 'animate-bounce text-white' : 'text-rose-400'}`} />
                <span>
                  {isIntercomRecording
                    ? 'RECORDING LIVE • TAP OR RELEASE TO SEND'
                    : intercomStatus === 'sending'
                    ? 'TRANSMITTING TO LAPTOP...'
                    : intercomStatus === 'played'
                    ? 'BROADCAST COMPLETE!'
                    : 'TAP OR HOLD TO TALK'}
                </span>
              </button>

              <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-1">
                <span className="flex items-center space-x-1 text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  <span>Cloud: Kali_CCTV_Recordings2.0</span>
                </span>
                <span className="text-slate-500">ALSA / Realtek 95% Vol</span>
              </div>
            </div>

            {/* Recent Intercom Conversations List */}
            {intercomHistory && intercomHistory.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3 text-cyan-400" />
                    <span>RECENT CONVERSATIONS ({intercomHistory.length})</span>
                  </span>
                  <span className="text-cyan-400 font-bold">SAVED TO CLOUD</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {intercomHistory.slice(0, 5).map((rec: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 font-mono text-xs flex items-center justify-between gap-2"
                    >
                      <div className="truncate flex-1">
                        <div className="text-[11px] font-bold text-slate-200 truncate flex items-center space-x-1.5">
                          <Waves className="w-3 h-3 text-rose-400 shrink-0" />
                          <span className="truncate">{rec.filename}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 flex items-center space-x-2">
                          <span>{new Date(rec.timestamp).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>{Math.round(rec.size_bytes / 1024)} KB</span>
                          <span className="text-emerald-400 flex items-center space-x-0.5">
                            <Cloud className="w-2.5 h-2.5" />
                            <span>Kali_CCTV_Recordings2.0</span>
                          </span>
                        </div>
                      </div>
                      <a
                        href={rec.download_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white"
                        title="Download Intercom MP3"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: RECENT MOTION INCIDENTS & SNAPSHOT GALLERY */}
      <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wide text-slate-200">
              Recent Motion Incidents ({events.length})
            </h2>
          </div>
          <button
            onClick={fetchData}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            title="Refresh Incidents"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 font-mono">
            No motion events recorded yet. The system is actively monitoring...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {events.slice(0, 6).map((evt: any) => {
              const snapshotName = evt.details?.snapshot;
              const snapUrl = snapshotName ? api.getCctvEventSnapshotUrl(snapshotName) : null;
              const dateStr = new Date(evt.timestamp).toLocaleTimeString();
              const score = evt.details?.motion_score || 0;

              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedSnapshot({ url: snapUrl, evt })}
                  className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500/50 bg-black aspect-video cursor-pointer transition-all hover:scale-[1.02]"
                >
                  {snapUrl ? (
                    <img
                      src={snapUrl}
                      alt="Incident Snapshot"
                      className="w-full h-full object-cover group-hover:brightness-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-[10px] text-slate-500">
                      NO SNAPSHOT
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90 group-hover:opacity-100 flex flex-col justify-end p-1.5">
                    <span className="text-[10px] font-mono text-cyan-300 font-bold">{dateStr}</span>
                    <span className="text-[9px] font-mono text-slate-400">Score: {score}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: 24/7 CCTV VIDEO RECORDINGS & GOOGLE DRIVE CLOUD BACKUP */}
      <div className="bg-cyber-surface/90 border border-cyber-border rounded-2xl p-4 space-y-3 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wide text-slate-200">
              24/7 CCTV Video Recordings
            </h2>
          </div>

          <div className="flex items-center space-x-2 font-mono text-xs">
            {/* Tab Switcher: Cloud vs Local */}
            <div className="flex items-center bg-slate-900 rounded-xl p-0.5 border border-slate-800">
              <button
                onClick={() => setRecordingsTab('cloud')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition-all ${
                  recordingsTab === 'cloud'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3 h-3" />
                <span>CLOUD DRIVE ({cloudRecordings.length})</span>
              </button>
              <button
                onClick={() => setRecordingsTab('local')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition-all ${
                  recordingsTab === 'local'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>LOCAL ({recordings.length})</span>
              </button>
            </div>

            <button
              onClick={handleSyncToDrive}
              disabled={actionLoading === 'sync_drive'}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold transition-all disabled:opacity-50 text-[10px] flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${actionLoading === 'sync_drive' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{actionLoading === 'sync_drive' ? 'SYNCING...' : 'SYNC ALL'}</span>
            </button>
          </div>
        </div>

        {/* Display Cloud or Local Recordings depending on active tab */}
        {recordingsTab === 'cloud' ? (
          cloudRecordings.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono space-y-1">
              <div>No cloud recordings found in Google Drive yet.</div>
              <div className="text-[10px] text-slate-600">Folder: Kali_CCTV_Recordings2.0</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cloudRecordings.map((rec: any, idx: number) => {
                const sizeMb = (rec.size_bytes / (1024 * 1024)).toFixed(1);
                const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleString() : 'Recent';

                return (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 font-mono space-y-2 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <Cloud className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-200 truncate">{rec.filename}</div>
                          <div className="text-[10px] text-slate-400">{dateStr}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] bg-black/40 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-300 font-bold">{sizeMb} MB</span>
                      <span className="text-emerald-400 flex items-center space-x-1 font-bold">
                        <span>24/7 Cloud Available</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => setSelectedVideoForPlayer(rec)}
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>WATCH</span>
                      </button>
                      <a
                        href={rec.download_url}
                        download
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>DOWNLOAD</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          recordings.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              No local recordings on laptop disk. Check Cloud Drive tab for all saved backups.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recordings.map((rec: any, idx: number) => {
                const streamVideoUrl = api.getCctvVideoStreamUrl(rec.filename);
                const downloadUrl = `/api/camera/cctv/recordings/${encodeURIComponent(rec.filename)}`;
                const sizeMb = (rec.size_bytes / (1024 * 1024)).toFixed(1);
                const dateStr = new Date(rec.created_at || rec.timestamp).toLocaleString();

                return (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-3 font-mono space-y-2 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                          <Video className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-200 truncate">{rec.filename}</div>
                          <div className="text-[10px] text-slate-400">{dateStr}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] bg-black/40 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-slate-300 font-bold">{sizeMb} MB</span>
                      <span className="text-slate-400">{rec.duration_sec ? `${Math.floor(rec.duration_sec / 60)}m` : '30m'}</span>
                      <span className="text-cyan-400 flex items-center space-x-1 font-bold">
                        <span>Local Disk</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => setSelectedVideoForPlayer({
                          ...rec,
                          id: rec.filename,
                          stream_url: streamVideoUrl,
                          download_url: downloadUrl,
                          is_cloud: false
                        })}
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>WATCH</span>
                      </button>
                      <a
                        href={downloadUrl}
                        download
                        className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>DOWNLOAD</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div
            className="max-w-3xl w-full bg-cyber-surface border border-cyber-border rounded-2xl overflow-hidden space-y-3 p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono text-cyan-300 font-bold">
                INCIDENT SNAPSHOT: {new Date(selectedSnapshot.evt.timestamp).toLocaleString()}
              </span>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
              <img
                src={selectedSnapshot.url}
                alt="Enlarged Incident Snapshot"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <span>Targets: {selectedSnapshot.evt.details?.targets_count || 1}</span>
              <span>Score: {selectedSnapshot.evt.details?.motion_score || 0}%</span>
              <a
                href={selectedSnapshot.url}
                download
                className="flex items-center space-x-1 text-cyan-400 hover:underline"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>DOWNLOAD PHOTO</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Microphone Insecure Origin Guidance Modal */}
      {showSecurityModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowSecurityModal(false)}
        >
          <div
            className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-2xl overflow-hidden p-5 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold font-mono text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>MOBILE MIC PERMISSION GUIDE</span>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Mobile browsers (Android Chrome & iOS Safari) automatically restrict microphone access on plain <span className="text-amber-300 font-bold">HTTP</span> origins.
            </p>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-bold text-cyan-400 block">METHOD 1 (RECOMMENDED): HTTPS Cloudflare Tunnel</span>
                <p className="text-slate-400 text-[11px]">
                  Use the secure HTTPS Tunnel URL (<span className="text-emerald-300">https://...trycloudflare.com</span>) from the Global Access menu. HTTPS enables native microphone access instantly on any phone!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-bold text-amber-400 block">METHOD 2: Android Chrome Insecure Origin Flag</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  1. In Android Chrome, open: <span className="text-amber-300 select-all">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span><br/>
                  2. Add: <span className="text-cyan-300 font-bold select-all">http://{window.location.host}</span><br/>
                  3. Set to <b>Enabled</b> and tap <b>Relaunch</b>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition-all"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Siren & Intercom Modal */}
      <SirenModal
        isOpen={showSirenModal}
        onClose={() => setShowSirenModal(false)}
      />

      {/* In-App CCTV Video Player Modal */}
      <CctvVideoPlayerModal
        video={selectedVideoForPlayer}
        onClose={() => setSelectedVideoForPlayer(null)}
      />
    </div>
  );
};
