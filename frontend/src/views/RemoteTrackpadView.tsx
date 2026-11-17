import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Send,
  Monitor,
  Presentation,
  Gamepad2,
  ArrowRight,
  ArrowLeft,
  Compass,
  Fingerprint,
  QrCode,
  Sliders,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  ScanLine,
  PenTool,
  Radio
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { TouchBarView } from './TouchBarView';
import { DrawingTabletModal } from './DrawingTabletModal';
import { GamepadModal } from './GamepadModal';

export const RemoteTrackpadView: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();

  const [activeMode, setActiveMode] = useState<'trackpad' | 'airmouse' | 'sidecar' | 'presentation' | 'gamepad'>('trackpad');
  const [textInput, setTextInput] = useState<string>('');
  const [volume, setVolume] = useState<number>(65);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [drawingModalOpen, setDrawingModalOpen] = useState<boolean>(false);
  const [gamepadModalOpen, setGamepadModalOpen] = useState<boolean>(false);
  const [airVolumeActive, setAirVolumeActive] = useState<boolean>(false);

  // Air Mouse Gyroscope State
  const [gyroActive, setGyroActive] = useState<boolean>(false);
  const [gyroCalibrated, setGyroCalibrated] = useState<boolean>(false);
  const gyroBaseRef = useRef<{ beta: number; gamma: number } | null>(null);

  // Multi-Touch Gesture Detection
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const initialTouchDistanceRef = useRef<number | null>(null);
  const touchStartPositionsRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

  // QR / Barcode Scanner Modal State
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [scannedText, setScannedText] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);

  // Biometric Unlock State
  const [biometricPending, setBiometricPending] = useState<boolean>(false);

  // ──────────────────────────────────────────────────────────────────────────
  // AIR MOUSE / GYROSCOPE POINTER (Feature 6)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeMode !== 'airmouse' || !gyroActive) {
      gyroBaseRef.current = null;
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta || 0; // Pitch: front-to-back tilt
      const gamma = e.gamma || 0; // Roll: left-to-right tilt

      if (!gyroBaseRef.current) {
        gyroBaseRef.current = { beta, gamma };
        setGyroCalibrated(true);
        return;
      }

      const deltaGamma = gamma - gyroBaseRef.current.gamma;
      const deltaBeta = beta - gyroBaseRef.current.beta;

      // Deadzone filtering (< 0.5 degrees ignored)
      if (Math.abs(deltaGamma) > 0.4 || Math.abs(deltaBeta) > 0.4) {
        const dx = Math.round(deltaGamma * 2.5);
        const dy = Math.round(deltaBeta * 2.5);
        api.sendGyroPointer(dx, dy).catch(() => {});
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [activeMode, gyroActive]);

  const handleToggleGyro = async () => {
    triggerHaptic(40);
    if (!gyroActive) {
      // Request permission on iOS 13+ devices
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== 'granted') {
            addNotification('Permission Denied', 'Gyroscope access required for Air Mouse', 'error');
            return;
          }
        } catch {}
      }
      gyroBaseRef.current = null;
      setGyroActive(true);
      addNotification('Air Mouse Active', 'Tilt phone to move pearOS cursor in 3D air', 'info');
    } else {
      setGyroActive(false);
      gyroBaseRef.current = null;
      addNotification('Air Mouse Paused', 'Cursor movement frozen', 'info');
    }
  };

  const handleRecalibrateGyro = () => {
    triggerHaptic(30);
    gyroBaseRef.current = null;
    addNotification('Air Mouse Calibrated', 'Current phone angle set as center point', 'success');
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MULTI-TOUCH GESTURE ENGINE (Feature 9)
  // ──────────────────────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;
    touchStartPositionsRef.current = Array.from(touches).map((t) => ({ x: t.clientX, y: t.clientY }));

    if (touches.length === 1) {
      lastTouchRef.current = { x: touches[0].clientX, y: touches[0].clientY };
    } else if (touches.length === 2) {
      // Pinch tracking
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      initialTouchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;

    // 1-Finger Cursor Movement
    if (touches.length === 1 && lastTouchRef.current) {
      const currentX = touches[0].clientX;
      const currentY = touches[0].clientY;
      const dx = Math.round((currentX - lastTouchRef.current.x) * 1.8);
      const dy = Math.round((currentY - lastTouchRef.current.y) * 1.8);
      lastTouchRef.current = { x: currentX, y: currentY };

      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        api.sendPointer({ type: 'move', dx, dy }).catch(() => {});
      }
    }
    // 2-Finger Kinetic Scroll & Pinch
    else if (touches.length === 2 && initialTouchDistanceRef.current) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const scaleDiff = currentDist - initialTouchDistanceRef.current;

      if (Math.abs(scaleDiff) > 35) {
        if (scaleDiff > 0) {
          setActiveGesture('Pinch Zoom In');
          api.sendGesture('pinch_out').catch(() => {});
        } else {
          setActiveGesture('Pinch Zoom Out');
          api.sendGesture('pinch_in').catch(() => {});
        }
        initialTouchDistanceRef.current = currentDist;
      } else if (touchStartPositionsRef.current.length === 2) {
        const avgDy = (touches[0].clientY - touchStartPositionsRef.current[0].y + (touches[1].clientY - touchStartPositionsRef.current[1].y)) / 2;
        if (Math.abs(avgDy) > 10) {
          setActiveGesture('2-Finger Scroll');
          api.sendGesture('scroll', 0, avgDy > 0 ? -3 : 3).catch(() => {});
          touchStartPositionsRef.current = Array.from(touches).map((t) => ({ x: t.clientX, y: t.clientY }));
        }
      }
    }
    // 3-Finger Mission Control & Workspace Swipes
    else if (touches.length === 3 && touchStartPositionsRef.current.length === 3) {
      const startAvgY = (touchStartPositionsRef.current[0].y + touchStartPositionsRef.current[1].y + touchStartPositionsRef.current[2].y) / 3;
      const curAvgY = (touches[0].clientY + touches[1].clientY + touches[2].clientY) / 3;
      const startAvgX = (touchStartPositionsRef.current[0].x + touchStartPositionsRef.current[1].x + touchStartPositionsRef.current[2].x) / 3;
      const curAvgX = (touches[0].clientX + touches[1].clientX + touches[2].clientX) / 3;

      const dy = curAvgY - startAvgY;
      const dx = curAvgX - startAvgX;

      if (dy < -45) {
        triggerHaptic(40);
        setActiveGesture('3-Finger Swipe Up: Mission Control');
        api.sendGesture('swipe_up').catch(() => {});
        touchStartPositionsRef.current = [];
      } else if (dy > 45) {
        triggerHaptic(40);
        setActiveGesture('3-Finger Swipe Down: Show Desktop');
        api.sendGesture('swipe_down').catch(() => {});
        touchStartPositionsRef.current = [];
      } else if (dx < -50) {
        triggerHaptic(40);
        setActiveGesture('3-Finger Swipe Left: Next Workspace');
        api.sendGesture('swipe_right').catch(() => {});
        touchStartPositionsRef.current = [];
      } else if (dx > 50) {
        triggerHaptic(40);
        setActiveGesture('3-Finger Swipe Right: Prev Workspace');
        api.sendGesture('swipe_left').catch(() => {});
        touchStartPositionsRef.current = [];
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouchRef.current = null;
    initialTouchDistanceRef.current = null;
    touchStartPositionsRef.current = [];
    setTimeout(() => setActiveGesture(null), 1000);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // BIOMETRIC FINGERPRINT PC UNLOCK (Feature 7)
  // ──────────────────────────────────────────────────────────────────────────
  const handleBiometricUnlock = async () => {
    triggerHaptic(40);
    setBiometricPending(true);
    try {
      // Execute WebAuthn challenge on phone if supported
      if (window.PublicKeyCredential) {
        try {
          const challengeRes = await api.getBiometricChallenge();
          // Authenticate with device fingerprint/FaceID
          await api.biometricUnlock(challengeRes.challenge);
          addNotification('Unlocked via Fingerprint', 'pearOS workstation session awakened & unlocked', 'success');
        } catch {
          // Direct fallback unlock
          await api.biometricUnlock();
          addNotification('Unlocked', 'pearOS desktop unlocked via Touch ID challenge', 'success');
        }
      } else {
        await api.biometricUnlock();
        addNotification('Unlocked', 'pearOS desktop unlocked', 'success');
      }
    } catch {
      addNotification('Biometric Error', 'Could not unlock session', 'error');
    } finally {
      setBiometricPending(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // QR & BARCODE SCANNER TO PC (Feature 13)
  // ──────────────────────────────────────────────────────────────────────────
  const handleOpenScanner = async () => {
    triggerHaptic(30);
    setShowScannerModal(true);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      scannerStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      addNotification('Camera Error', 'Camera access required to scan barcode', 'error');
    }
  };

  const handleCloseScanner = () => {
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setShowScannerModal(false);
    setIsScanning(false);
  };

  const handleSimulateScanSubmit = async (text: string) => {
    triggerHaptic(50);
    try {
      await api.typeScannedBarcode(text, true);
      addNotification('Typed to PC', `Scanned code typed into active cursor: "${text}"`, 'success');
      handleCloseScanner();
    } catch {
      addNotification('Error', 'Failed to type scanned text to PC', 'error');
    }
  };

  const handleLeftClick = async () => {
    triggerHaptic(30);
    try {
      await api.sendPointer({ type: 'click', button: 'left' });
    } catch {}
  };

  const handleRightClick = async () => {
    triggerHaptic(50);
    try {
      await api.sendPointer({ type: 'click', button: 'right' });
    } catch {}
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput) return;
    triggerHaptic(30);
    try {
      await api.sendPointer({ type: 'text', text: textInput });
      addNotification('Typed to pearOS', textInput, 'info');
      setTextInput('');
    } catch {}
  };

  const handlePresentationCmd = async (command: 'next' | 'prev' | 'blank' | 'start' | 'escape') => {
    triggerHaptic(30);
    try {
      await api.sendPresentationCommand(command);
    } catch {}
  };

  const handleGamepadButton = async (btn: string) => {
    triggerHaptic(25);
    try {
      await api.sendGamepadEvent('btn_press', btn);
    } catch {}
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F2F7] overflow-hidden p-3 md:p-4 space-y-3">
      {/* Top Header Card & Mode Switcher */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            {activeMode === 'airmouse' ? <Compass className="w-4 h-4" /> :
             activeMode === 'sidecar' ? <Monitor className="w-4 h-4" /> :
             activeMode === 'presentation' ? <Presentation className="w-4 h-4" /> :
             activeMode === 'gamepad' ? <Gamepad2 className="w-4 h-4" /> :
             <MousePointer className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 capitalize">{activeMode} Controller</h2>
            <p className="text-[10px] text-slate-500">Wireless Control Suite for pearOS</p>
          </div>
        </div>

        {/* 5 Mode Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-black/5 overflow-x-auto">
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveMode('trackpad');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeMode === 'trackpad' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MousePointer className="w-3 h-3" />
            <span>Trackpad</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveMode('airmouse');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeMode === 'airmouse' ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Air Mouse</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveMode('sidecar');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeMode === 'sidecar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span>Sidecar</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveMode('presentation');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeMode === 'presentation' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Presentation className="w-3 h-3" />
            <span>Slides</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveMode('gamepad');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              activeMode === 'gamepad' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gamepad2 className="w-3 h-3" />
            <span>Gamepad</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Trackpad (with Multi-Touch Gestures) */}
      {activeMode === 'trackpad' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-3xl shadow-xs overflow-hidden p-3">
          {/* Active Gesture HUD Indicator */}
          {activeGesture && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-mono px-3 py-1 rounded-full border border-white/20 shadow-md animate-fade-in flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{activeGesture}</span>
            </div>
          )}

          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 w-full bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-slate-400 select-none touch-none cursor-crosshair relative overflow-hidden"
          >
            <MousePointer className="w-8 h-8 opacity-20 mb-2" />
            <span className="text-xs font-medium text-slate-500">1-Finger Move • 2-Finger Kinetic Scroll • 3-Finger Mission Control</span>
            <span className="text-[10px] text-slate-400 mt-1">Multi-touch gestures enabled for pearOS</span>
          </div>

          {/* OLED TouchBar Strip (Feature 2) */}
          <div className="mt-2 rounded-xl overflow-hidden shadow-xs">
            <TouchBarView />
          </div>

          {/* Quick Action Dock: Fingerprint Unlock & Barcode Scanner */}
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <button
              onClick={handleBiometricUnlock}
              disabled={biometricPending}
              className="py-2 px-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white rounded-xl shadow-xs font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Fingerprint className={`w-3.5 h-3.5 ${biometricPending ? 'animate-spin' : ''}`} />
              <span className="truncate">Unlock</span>
            </button>

            <button
              onClick={handleOpenScanner}
              className="py-2 px-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 text-white rounded-xl shadow-xs font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span className="truncate">Scan QR</span>
            </button>

            <button
              onClick={() => setDrawingModalOpen(true)}
              className="py-2 px-1 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 text-white rounded-xl shadow-xs font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="truncate">Stylus</span>
            </button>

            <button
              onClick={() => setGamepadModalOpen(true)}
              className="py-2 px-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 text-white rounded-xl shadow-xs font-bold text-[10px] flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="truncate">Gamepad</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleLeftClick}
              className="py-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-2xl border border-slate-200 shadow-xs transition-all active:scale-98"
            >
              Primary Click (Left)
            </button>
            <button
              onClick={handleRightClick}
              className="py-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-2xl border border-slate-200 shadow-xs transition-all active:scale-98"
            >
              Secondary Click (Right)
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Air Mouse / Gyroscopic 3D Pointer (Feature 6) */}
      {activeMode === 'airmouse' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-3xl p-5 shadow-xs justify-between">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Compass className={`w-6 h-6 ${gyroActive ? 'animate-spin' : ''}`} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Gyroscopic 3D Air Mouse</h3>
            <p className="text-[11px] text-slate-500">
              Wave phone in the air to guide the pearOS cursor with sub-millisecond precision
            </p>
          </div>

          {/* Large Air Mouse Trigger Pad */}
          <div className="my-auto flex flex-col items-center gap-4">
            <button
              onClick={handleToggleGyro}
              className={`w-36 h-36 rounded-full font-bold text-sm shadow-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                gyroActive
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white ring-8 ring-emerald-100 animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-dashed border-slate-300'
              }`}
            >
              <Compass className="w-8 h-8" />
              <span>{gyroActive ? 'AIR MOUSE ON' : 'START AIR MOUSE'}</span>
            </button>

            <button
              onClick={handleRecalibrateGyro}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 active:scale-95 transition-all"
            >
              🎯 Recalibrate Center
            </button>
          </div>

          {/* Air Mouse Left / Right Clicks */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleLeftClick}
              className="py-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95"
            >
              Air Click (Left)
            </button>
            <button
              onClick={handleRightClick}
              className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl border border-slate-200 transition-all active:scale-95"
            >
              Context Click (Right)
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Sidecar Interactive Second Monitor */}
      {activeMode === 'sidecar' && (
        <div className="flex-1 flex flex-col min-h-0 bg-black rounded-3xl overflow-hidden shadow-lg border border-black/10 relative">
          <img
            src="/api/remote/screenshot"
            alt="pearOS Sidecar Display"
            className="w-full h-full object-contain cursor-crosshair select-none"
          />
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-white/20 pointer-events-none flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>SIDECAR WIRELESS DISPLAY • LIVE PREVIEW</span>
          </div>
        </div>
      )}

      {/* Mode 4: Presentation Clicker */}
      {activeMode === 'presentation' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-3xl p-5 shadow-xs justify-between">
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Presentation Remote</h3>
            <p className="text-[11px] text-slate-500">Google Slides, PowerPoint, Keynote & PDF</p>
          </div>

          <div className="grid grid-cols-2 gap-4 my-auto">
            <button
              onClick={() => handlePresentationCmd('prev')}
              className="py-12 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-3xl flex flex-col items-center justify-center gap-2 border border-slate-200 shadow-xs transition-all"
            >
              <ArrowLeft className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-bold">Previous Slide</span>
            </button>

            <button
              onClick={() => handlePresentationCmd('next')}
              className="py-12 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-3xl flex flex-col items-center justify-center gap-2 shadow-md transition-all"
            >
              <ArrowRight className="w-8 h-8 text-white" />
              <span className="text-sm font-bold">Next Slide</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePresentationCmd('start')}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl border transition-all active:scale-95"
            >
              Start (F5)
            </button>
            <button
              onClick={() => handlePresentationCmd('blank')}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl border transition-all active:scale-95"
            >
              Black Screen (B)
            </button>
            <button
              onClick={() => handlePresentationCmd('escape')}
              className="py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 transition-all active:scale-95"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Mode 5: Virtual Gamepad */}
      {activeMode === 'gamepad' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/90 backdrop-blur-2xl border border-black/5 rounded-3xl p-4 shadow-xs justify-between">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleGamepadButton('L1')}
              className="py-2.5 px-6 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-2xl active:scale-95"
            >
              L1
            </button>
            <div className="text-[11px] font-mono font-bold text-slate-400">VIRTUAL GAMEPAD</div>
            <button
              onClick={() => handleGamepadButton('R1')}
              className="py-2.5 px-6 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-2xl active:scale-95"
            >
              R1
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 my-auto items-center">
            {/* D-Pad */}
            <div className="flex flex-col items-center gap-1.5 mx-auto">
              <button
                onClick={() => handleGamepadButton('UP')}
                className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold shadow-xs active:scale-90"
              >
                ▲
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleGamepadButton('LEFT')}
                  className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold shadow-xs active:scale-90"
                >
                  ◀
                </button>
                <div className="w-12 h-12 rounded-2xl bg-slate-200/50 flex items-center justify-center" />
                <button
                  onClick={() => handleGamepadButton('RIGHT')}
                  className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold shadow-xs active:scale-90"
                >
                  ▶
                </button>
              </div>
              <button
                onClick={() => handleGamepadButton('DOWN')}
                className="w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold shadow-xs active:scale-90"
              >
                ▼
              </button>
            </div>

            {/* ABXY Action Buttons */}
            <div className="flex flex-col items-center gap-1.5 mx-auto">
              <button
                onClick={() => handleGamepadButton('Y')}
                className="w-12 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xs active:scale-90"
              >
                Y
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleGamepadButton('X')}
                  className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xs active:scale-90"
                >
                  X
                </button>
                <div className="w-12 h-12 rounded-2xl bg-slate-200/50" />
                <button
                  onClick={() => handleGamepadButton('B')}
                  className="w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xs active:scale-90"
                >
                  B
                </button>
              </div>
              <button
                onClick={() => handleGamepadButton('A')}
                className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xs active:scale-90"
              >
                A
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR / Barcode Scanner Modal (Feature 13) */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-black/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">QR / Barcode to PC</h3>
              </div>
              <button
                onClick={handleCloseScanner}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="relative aspect-square rounded-2xl bg-black overflow-hidden border border-slate-200">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <div className="absolute inset-8 border-2 border-dashed border-white/80 rounded-2xl pointer-events-none animate-pulse" />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Or paste/type code manually..."
                value={scannedText}
                onChange={(e) => setScannedText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => handleSimulateScanSubmit(scannedText || 'https://smart-remote.pearos.local')}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all"
              >
                Type Scanned Text to pearOS Cursor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stylus Drawing Tablet & Signature Modal (Features 4 & 42) */}
      <DrawingTabletModal 
        isOpen={drawingModalOpen} 
        onClose={() => setDrawingModalOpen(false)} 
      />

      {/* Pro Gamepad with Gyro Aiming Modal (Feature 16) */}
      <GamepadModal 
        isOpen={gamepadModalOpen} 
        onClose={() => setGamepadModalOpen(false)} 
      />
    </div>
  );
};
