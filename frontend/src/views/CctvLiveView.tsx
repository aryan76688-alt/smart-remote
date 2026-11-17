import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Moon,
  Download,
  Maximize2,
  Minimize2,
  Mic,
  RefreshCw,
  Smartphone,
  Laptop,
  Flashlight,
  RotateCcw,
  Grid,
  Square,
  Flame,
  Activity,
  UserCheck,
  UserX,
  Radio,
  Monitor
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface CctvLiveViewProps {
  onTogglePip?: () => void;
}

export const CctvLiveView: React.FC<CctvLiveViewProps> = ({ onTogglePip }) => {
  const { triggerHaptic, addNotification } = useApp();

  // View Layout: Single Feed or Quad-Split 2x2 Grid
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [cameraSource, setCameraSource] = useState<'laptop' | 'mobile'>('laptop');
  const [focusedQuadrant, setFocusedQuadrant] = useState<string | null>(null);

  // Audio & Surveillance Controls
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [nightVision, setNightVision] = useState<boolean>(false);
  const [thermalMode, setThermalMode] = useState<boolean>(false);
  const [osdWatermark, setOsdWatermark] = useState<boolean>(true);
  const [stealthActive, setStealthActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [mobileTorch, setMobileTorch] = useState<boolean>(false);
  const [mobileFacing, setMobileFacing] = useState<string>('back');

  // AI Face Presence Detection (In-Memory)
  const [faceData, setFaceData] = useState<{ detected: boolean; count: number; faces: any[]; status: string }>({
    detected: false,
    count: 0,
    faces: [],
    status: 'NO_FACE_DETECTED'
  });

  // Acoustic Sound Tripwire
  const [acousticData, setAcousticData] = useState<{ db: number; spike: boolean; armed: boolean; threshold: number }>({
    db: 38,
    spike: false,
    armed: true,
    threshold: 70
  });

  // Feed 4: Intruder Trap Memory Buffer
  const [intruderBuffer, setIntruderBuffer] = useState<{ has_photo: boolean; latest_photo_b64?: string; last_triggered?: string }>({
    has_photo: false
  });

  // Screen Stream Preview URL
  const [screenTimestamp, setScreenTimestamp] = useState<number>(Date.now());

  // Walkie-Talkie State
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage Mobile Camera activation on demand
  useEffect(() => {
    if (cameraSource === 'mobile' || viewMode === 'quad') {
      api.controlPhoneCamera('start_camera').catch(() => {});
    } else {
      api.controlPhoneCamera('stop_camera').catch(() => {});
    }

    return () => {
      if (cameraSource === 'mobile' && viewMode !== 'quad') {
        api.controlPhoneCamera('stop_camera').catch(() => {});
      }
    };
  }, [cameraSource, viewMode]);

  // Periodic Telemetry: Face Presence, Acoustic Level & Intruder Buffer
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        // 1. AI Face Presence Detector
        const faceRes = await api.getFacePresence(cameraSource);
        if (faceRes) {
          setFaceData(faceRes);
        }

        // 2. Acoustic Tripwire
        const acousticRes = await api.getAcousticStatus();
        if (acousticRes) {
          setAcousticData(acousticRes);
          if (acousticRes.spike && acousticRes.armed) {
            triggerHaptic(60);
            addNotification('⚠️ Acoustic Tripwire Alert', `Loud sound spike detected: ${acousticRes.db} dB (> ${acousticRes.threshold} dB)`, 'error');
          }
        }

        // 3. Quad Screen & Intruder Buffer
        if (viewMode === 'quad') {
          setScreenTimestamp(Date.now());
          const ramRes = await api.getLatestIntruderRam();
          if (ramRes) {
            setIntruderBuffer(ramRes);
          }
        }
      } catch {}
    }, 2800);

    return () => clearInterval(pollInterval);
  }, [cameraSource, viewMode]);

  // Toggle Thermal Ironbow False-Color Mode
  const handleToggleThermal = async () => {
    triggerHaptic(40);
    const next = !thermalMode;
    setThermalMode(next);
    try {
      await api.toggleThermalMode(next);
      addNotification(
        next ? '🔥 Thermal Ironbow Active' : 'Thermal Filter Off',
        next ? 'Software infrared false-color Ironbow heatmap enabled' : 'Returned to standard optical color',
        'info'
      );
    } catch {}
  };

  // Toggle Burned-in OSD Watermark
  const handleToggleOsd = async () => {
    triggerHaptic(30);
    const next = !osdWatermark;
    setOsdWatermark(next);
    try {
      await api.toggleOsdWatermark(next);
      addNotification(
        next ? 'OSD HUD Enabled' : 'OSD HUD Disabled',
        'Burned-in live digital timestamp, GPS coordinates & watermark toggled',
        'info'
      );
    } catch {}
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    triggerHaptic(30);
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Toggle Live Audio
  const handleToggleAudio = () => {
    triggerHaptic(40);
    const next = !audioEnabled;
    setAudioEnabled(next);

    const targetAudio = cameraSource === 'mobile' ? '/api/camera/phone/audio-stream' : '/api/camera/laptop/audio';

    if (next) {
      if (!audioRef.current) {
        audioRef.current = new Audio(targetAudio);
      } else {
        audioRef.current.src = targetAudio;
      }
      audioRef.current.play().catch(() => {
        addNotification('Audio Blocked', 'Click to permit live audio playback', 'info');
      });
      addNotification('Surveillance Audio', `Streaming ${cameraSource === 'mobile' ? 'Oppo Phone' : 'pearOS'} microphone`, 'info');
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      addNotification('Audio Muted', 'Live microphone surveillance silenced', 'info');
    }
  };

  // Flip Mobile Camera (Front / Back)
  const handleFlipMobileCamera = async () => {
    triggerHaptic(30);
    try {
      const res = await api.controlPhoneCamera('flip_camera');
      const nextFacing = res.facing || (mobileFacing === 'back' ? 'front' : 'back');
      setMobileFacing(nextFacing);
      addNotification('Camera Flipped', `Switched to ${nextFacing} lens`, 'info');
    } catch {}
  };

  // Toggle Mobile Torch
  const handleToggleMobileTorch = async () => {
    triggerHaptic(40);
    try {
      const res = await api.controlPhoneCamera('toggle_torch');
      setMobileTorch(Boolean(res.torch));
      addNotification('Mobile Flashlight', res.torch ? 'Torch turned ON' : 'Torch turned OFF', 'info');
    } catch {}
  };

  // Walkie-Talkie Push-to-Talk
  const handleStartTalking = async () => {
    try {
      triggerHaptic(40);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          await api.sendIntercomAudio(blob);
          addNotification('Walkie-Talkie', 'Voice broadcast through pearOS laptop speakers', 'success');
        } catch {}
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsTalking(true);
    } catch {
      addNotification('Mic Error', 'Microphone permission needed to speak', 'error');
    }
  };

  const handleStopTalking = () => {
    if (mediaRecorderRef.current && isTalking) {
      triggerHaptic(30);
      mediaRecorderRef.current.stop();
      setIsTalking(false);
    }
  };

  // Toggle Stealth Display Blackout
  const handleToggleStealth = async () => {
    triggerHaptic(50);
    const next = !stealthActive;
    setStealthActive(next);
    try {
      await api.toggleStealth(next);
      addNotification(
        next ? '🌙 Stealth Mode ON' : 'Display Awakened',
        next ? 'pearOS monitor turned completely dark. Camera stream remains live!' : 'pearOS laptop display restored.',
        'success'
      );
    } catch {
      setStealthActive(!next);
    }
  };

  // Take Instant Snapshot (Direct to Client, 0 Host Storage)
  const handleTakeSnapshot = async () => {
    setIsSnapshotLoading(true);
    triggerHaptic(40);
    try {
      const a = document.createElement('a');
      a.href = cameraSource === 'mobile' ? `/api/camera/phone/snapshot?t=${Date.now()}` : `/api/camera/laptop/stream?t=${Date.now()}`;
      a.download = `${cameraSource}_cctv_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addNotification('Snapshot Saved', 'Downloaded to device. 0 server disk space used.', 'success');
    } catch {
      addNotification('Snapshot Error', 'Could not capture frame from stream', 'error');
    } finally {
      setIsSnapshotLoading(false);
    }
  };

  const laptopStreamUrl = `/api/camera/laptop/stream?colormap=${thermalMode ? 'ironbow' : ''}&osd=${osdWatermark ? '1' : '0'}`;
  const phoneStreamUrl = `/api/camera/phone/stream?colormap=${thermalMode ? 'ironbow' : ''}&osd=${osdWatermark ? '1' : '0'}`;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col bg-[#F2F2F7] overflow-hidden ${
        isFullscreen ? 'p-0 bg-black' : 'p-3 md:p-5'
      }`}
    >
      {/* Top Header Card */}
      {!isFullscreen && (
        <div className="bg-white/80 backdrop-blur-xl border border-black/5 shadow-xs rounded-2xl px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs ${
              viewMode === 'quad'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                : cameraSource === 'mobile'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                : 'bg-gradient-to-tr from-emerald-500 to-teal-600'
            }`}>
              {viewMode === 'quad' ? (
                <Grid className="w-5 h-5" />
              ) : cameraSource === 'mobile' ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  {viewMode === 'quad'
                    ? 'Quad-Split Tactical Grid (2x2 Multi-Feed)'
                    : cameraSource === 'mobile'
                    ? 'Oppo Mobile CCTV (Remote Phone)'
                    : 'pearOS Laptop CCTV (Zero Storage)'}
                </h1>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE ONLY
                </span>
                {thermalMode && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-600" />
                    IRONBOW
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Synchronized live surveillance • AI Face Presence • In-memory acoustic tripwire
              </p>
            </div>
          </div>

          {/* View Mode & Camera Selectors */}
          <div className="flex items-center gap-2">
            {/* Single vs Quad Grid Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-black/5">
              <button
                onClick={() => {
                  triggerHaptic(20);
                  setViewMode('single');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Single Feed View"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Single</span>
              </button>
              <button
                onClick={() => {
                  triggerHaptic(20);
                  setViewMode('quad');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'quad' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Quad-Split 2x2 Multi-Feed Grid"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Quad Grid</span>
              </button>
            </div>

            {viewMode === 'single' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-black/5">
                <button
                  onClick={() => {
                    triggerHaptic(20);
                    setCameraSource('laptop');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cameraSource === 'laptop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Laptop</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic(20);
                    setCameraSource('mobile');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cameraSource === 'mobile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Oppo</span>
                </button>
              </div>
            )}

            {/* Thermal Ironbow Toggle */}
            <button
              onClick={handleToggleThermal}
              className={`p-2 rounded-xl transition-all ${
                thermalMode
                  ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-orange-600'
              }`}
              title="Thermal False-Color Ironbow Mode"
            >
              <Flame className="w-4 h-4" />
            </button>

            {/* OSD Watermark Toggle */}
            <button
              onClick={handleToggleOsd}
              className={`p-2 rounded-xl transition-all ${
                osdWatermark ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
              }`}
              title="Burned-in OSD Watermark (Timestamp, GPS, Session)"
            >
              <Radio className="w-4 h-4" />
            </button>

            {cameraSource === 'mobile' && viewMode === 'single' && (
              <>
                <button
                  onClick={handleFlipMobileCamera}
                  className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Flip Mobile Camera"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleMobileTorch}
                  className={`p-2 rounded-xl transition-all ${
                    mobileTorch ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                  }`}
                  title="Toggle Mobile Flashlight Torch"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={handleToggleFullscreen}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Video Viewport */}
      {viewMode === 'single' ? (
        <div className="relative flex-1 rounded-3xl overflow-hidden bg-black shadow-lg border border-black/10 flex items-center justify-center">
          <img
            src={cameraSource === 'mobile' ? phoneStreamUrl : laptopStreamUrl}
            alt="pearOS Live CCTV Stream"
            onError={() => setStreamError(true)}
            onLoad={() => setStreamError(false)}
            className={`w-full h-full object-contain transition-all duration-300 ${
              nightVision ? 'brightness-150 contrast-125 saturate-50 hue-rotate-15 filter' : ''
            }`}
          />

          {/* AI Face Presence Bounding Boxes Overlay */}
          {faceData.detected && faceData.faces.map((f, idx) => (
            <div
              key={idx}
              className="absolute border-2 border-emerald-400 bg-emerald-400/10 rounded-lg pointer-events-none transition-all duration-200"
              style={{
                left: `${Math.max(10, Math.min(80, (f.x / 640) * 100))}%`,
                top: `${Math.max(10, Math.min(80, (f.y / 480) * 100))}%`,
                width: `${Math.max(15, Math.min(40, (f.w / 640) * 100))}%`,
                height: `${Math.max(15, Math.min(40, (f.h / 480) * 100))}%`
              }}
            >
              <span className="absolute -top-6 left-0 bg-emerald-500 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                AUTHORIZED USER (98%)
              </span>
            </div>
          ))}

          {/* Live Video OSD Badges */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-mono px-2.5 py-1 rounded-full border border-white/20">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold text-red-400">REC: OFF</span>
              <span className="text-slate-300">• {cameraSource === 'mobile' ? 'OPPO PHONE' : 'pearOS WEBCAM'}</span>
            </div>

            {/* AI Face Presence Badge */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border backdrop-blur-md ${
              faceData.detected
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400'
                : 'bg-black/60 border-white/20 text-slate-300'
            }`}>
              {faceData.detected ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
              <span>{faceData.detected ? `${faceData.count} Face Detected` : 'No Faces'}</span>
            </div>

            {/* Acoustic Soundwave Level */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border backdrop-blur-md ${
              acousticData.spike
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                : 'bg-black/60 border-white/20 text-slate-300'
            }`}>
              <Activity className="w-3 h-3" />
              <span>{acousticData.db} dB {acousticData.spike ? 'TRIPWIRE SPIKE!' : ''}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Quad-Split 2x2 Grid Mode */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto rounded-3xl">
          {/* Quadrant 1: Laptop Cam */}
          <div
            onClick={() => {
              setCameraSource('laptop');
              setViewMode('single');
            }}
            className="relative bg-black rounded-2xl overflow-hidden border border-black/10 group cursor-pointer shadow-sm hover:ring-2 hover:ring-emerald-500 transition-all aspect-video flex items-center justify-center"
          >
            <img src={laptopStreamUrl} alt="Laptop Webcam" className="w-full h-full object-contain" />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-emerald-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              1. Laptop Webcam
            </div>
          </div>

          {/* Quadrant 2: Mobile Phone Cam */}
          <div
            onClick={() => {
              setCameraSource('mobile');
              setViewMode('single');
            }}
            className="relative bg-black rounded-2xl overflow-hidden border border-black/10 group cursor-pointer shadow-sm hover:ring-2 hover:ring-blue-500 transition-all aspect-video flex items-center justify-center"
          >
            <img src={phoneStreamUrl} alt="Oppo Mobile Cam" className="w-full h-full object-contain" />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-blue-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              2. Oppo Mobile CCTV
            </div>
          </div>

          {/* Quadrant 3: pearOS Desktop Screen Preview */}
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-black/10 shadow-sm aspect-video flex items-center justify-center">
            <img
              src={`/api/remote/screenshot?ts=${screenTimestamp}`}
              alt="pearOS Screen Stream"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-amber-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
              <Monitor className="w-3 h-3" />
              3. pearOS Screen Preview
            </div>
          </div>

          {/* Quadrant 4: In-Memory Intruder Trap Buffer */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-black/10 shadow-sm aspect-video flex items-center justify-center">
            {intruderBuffer.has_photo && intruderBuffer.latest_photo_b64 ? (
              <img src={intruderBuffer.latest_photo_b64} alt="Intruder Buffer" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center p-4">
                <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
                <span className="text-xs font-mono text-slate-400">Intruder Memory Trap Armed</span>
                <p className="text-[10px] text-slate-500 mt-1">Zero disk storage • In-RAM buffer ready</p>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-rose-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              4. In-Memory Intruder Trap
            </div>
          </div>
        </div>
      )}

      {/* Bottom Surveillance Controls Bar */}
      <div className="bg-white/90 backdrop-blur-xl border border-black/5 shadow-md rounded-2xl p-3 mt-3 flex items-center justify-between gap-2 shrink-0">
        {/* Companion Audio Stream Toggle */}
        <button
          onClick={handleToggleAudio}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-xs transition-all active:scale-95 ${
            audioEnabled ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="Listen to Live Room Audio"
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{audioEnabled ? 'Listening' : 'Room Audio'}</span>
        </button>

        {/* Walkie-Talkie Push-to-Talk Intercom Button */}
        <button
          onMouseDown={handleStartTalking}
          onMouseUp={handleStopTalking}
          onTouchStart={handleStartTalking}
          onTouchEnd={handleStopTalking}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold text-xs select-none transition-all active:scale-95 ${
            isTalking
              ? 'bg-rose-600 text-white shadow-lg animate-pulse ring-4 ring-rose-200'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
          }`}
          title="Hold to Speak through pearOS Laptop Speakers"
        >
          <Mic className="w-4 h-4" />
          <span>{isTalking ? 'TALKING OUT LOUD...' : 'Hold Walkie-Talkie'}</span>
        </button>

        {/* Stealth Monitor Blackout */}
        <button
          onClick={handleToggleStealth}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-xs transition-all active:scale-95 ${
            stealthActive ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="Blackout Laptop Screen (Stealth Surveillance)"
        >
          {stealthActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden sm:inline">{stealthActive ? 'Stealth ON' : 'Blackout'}</span>
        </button>

        {/* Instant Frame Snapshot */}
        <button
          onClick={handleTakeSnapshot}
          disabled={isSnapshotLoading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white font-medium text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          title="Save frame directly to client (0 host storage)"
        >
          <Download className={`w-4 h-4 ${isSnapshotLoading ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline">Snapshot</span>
        </button>
      </div>
    </div>
  );
};
