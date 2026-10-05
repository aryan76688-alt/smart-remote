import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize, Minimize, ZoomIn, ZoomOut, RefreshCw, Camera,
  Wifi, Gamepad2, Keyboard, Touchpad, Sliders, Play, Pause,
  X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft,
  Delete, Eye, EyeOff, MousePointer, ChevronDown, ChevronUp, Layers,
  Lock, Unlock, Laptop, Smartphone, Video, VideoOff, Cloud,
  RotateCw, Shield, Disc, Check, Clock, Moon, Sun, AlertTriangle,
  Volume2, VolumeX, Mic, Radio, Waves
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const ScreenMirrorView: React.FC = () => {
  const { latencyMs, sendInput, networkType, networkLabel, bandwidthMode, setBandwidthMode } = useWebSocket();
  const {
    addNotification,
    deviceMode,
    immersiveMode,
    setImmersiveMode,
    setGdriveModalOpen,
    isApk,
    triggerHaptic,
    registerBackHandler
  } = useApp();

  // Screen resolution and stream telemetry
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1366, height: 768 });
  const [streamFps, setStreamFps] = useState<number>(25);
  const [streamQuality, setStreamQuality] = useState<number>(50);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'contain' | 'original'>('contain');

  // Fullscreen, Touch & Auto-Landscape states
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [touchModeEnabled, setTouchModeEnabled] = useState<boolean>(true);
  const [touchRipples, setTouchRipples] = useState<Array<{ id: number; x: number; y: number; isRightClick?: boolean }>>([]);
  const [isLandscapeRotated, setIsLandscapeRotated] = useState<boolean>(false);

  // Mouse cursor overlay state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 683, y: 384 });
  const [showCursor, setShowCursor] = useState<boolean>(true);

  // Dedicated F1-F12 Function Bar
  const [showFunctionBar, setShowFunctionBar] = useState<boolean>(false);

  // Two-Way Camera States
  // 1. Kali Laptop Webcam -> Phone
  const [showLaptopCam, setShowLaptopCam] = useState<boolean>(false);
  const [showLaptopCamFullscreen, setShowLaptopCamFullscreen] = useState<boolean>(false);
  // 2. Phone Camera -> Kali Laptop Screen
  const [isPhoneCamStreaming, setIsPhoneCamStreaming] = useState<boolean>(false);
  const [phoneFacingMode, setPhoneFacingMode] = useState<'user' | 'environment'>('user');
  const phoneVideoRef = useRef<HTMLVideoElement | null>(null);
  const phoneStreamRef = useRef<MediaStream | null>(null);
  const phoneFrameTimerRef = useRef<number | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // CCTV 24/7 Surveillance, High Definition & Google Drive Sync State
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [cctvStatus, setCctvStatus] = useState<{
    is_recording: boolean;
    always_record?: boolean;
    current_filename?: string;
    chunk_duration_sec: number;
    chunk_elapsed_sec: number;
    chunk_remaining_sec: number;
    total_chunks_recorded: number;
    auto_upload_gdrive: boolean;
    resolution?: string;
    fps?: number;
    night_mode?: boolean;
    motion_detected?: boolean;
  }>({
    is_recording: false,
    always_record: true,
    chunk_duration_sec: 1800,
    chunk_elapsed_sec: 0,
    chunk_remaining_sec: 1800,
    total_chunks_recorded: 0,
    auto_upload_gdrive: true,
    resolution: '1280x720',
    fps: 30,
    night_mode: false,
    motion_detected: false
  });
  const [cctvActionLoading, setCctvActionLoading] = useState<boolean>(false);
  const [liveTimeStr, setLiveTimeStr] = useState<string>('');

  // CCTV Live Microphone Audio Monitoring State
  const [cctvAudioEnabled, setCctvAudioEnabled] = useState<boolean>(true);
  const [cctvAudioVolume, setCctvAudioVolume] = useState<number>(1.0);
  const cctvAudioRef = useRef<HTMLAudioElement | null>(null);
  const [screenIsOff, setScreenIsOff] = useState<boolean>(false);

  const handleToggleStealthScreen = async () => {
    try {
      if (screenIsOff) {
        await api.wakeCctvScreen();
        setScreenIsOff(false);
      } else {
        await api.turnCctvScreenOff();
        setScreenIsOff(true);
      }
    } catch {
      // ignore
    }
  };

  // Motion Engine & Two-Way Voice Intercom State
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true);
  const [isIntercomRecording, setIsIntercomRecording] = useState<boolean>(false);
  const [intercomStatus, setIntercomStatus] = useState<string>('idle');
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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isStartingIntercomRef.current = false;
      alert('Microphone access requires HTTPS or Secure Context on mobile. Use Cloudflare Tunnel URL or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      intercomStreamRef.current = stream;

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

        if (audioBlob.size > 150) {
          setIntercomStatus('sending');
          try {
            const res = await api.sendIntercomAudio(audioBlob);
            if (res.success) {
              setIntercomStatus('played');
              addNotification(
                'Intercom Broadcast',
                'Voice played on laptop speakers & queued to Google Drive (Kali_CCTV_Recordings2.0)',
                'success'
              );
              setTimeout(() => setIntercomStatus('idle'), 2500);
            } else {
              setIntercomStatus('error');
              setTimeout(() => setIntercomStatus('idle'), 2500);
            }
          } catch (err) {
            console.error('Failed to send intercom audio:', err);
            setIntercomStatus('error');
            setTimeout(() => setIntercomStatus('idle'), 2500);
          }
        } else {
          setIntercomStatus('idle');
        }
      };

      recorder.start(100);
      setIsIntercomRecording(true);
      setIntercomStatus('recording');
    } catch (err) {
      console.error('Microphone permission denied:', err);
      alert('Microphone access is required to speak to laptop speakers. If accessing over HTTP, connect using your Cloudflare HTTPS Tunnel.');
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
      addNotification(
        'Motion Detection',
        nextVal ? 'Motion detection engine ON' : 'Motion detection OFF (Zero-Lag mode)',
        'info'
      );
    } catch {
      setMotionEnabled(!nextVal);
    }
  };

  const [autoLightAdjust, setAutoLightAdjust] = useState<boolean>(true);

  const handleToggleAutoLight = async () => {
    const nextVal = !autoLightAdjust;
    setAutoLightAdjust(nextVal);
    try {
      await api.toggleAutoLightAdjust(nextVal);
      addNotification(
        'Auto Light Adjust',
        nextVal ? 'Camera Auto-Adjust Lighting ENABLED' : 'Camera Auto-Adjust Lighting DISABLED',
        'info'
      );
    } catch {
      setAutoLightAdjust(!nextVal);
    }
  };

  // On-screen Mirror Overlays (especially in Fullscreen)
  const [showDPad, setShowDPad] = useState<boolean>(false);
  const [showKeyboard, setShowKeyboard] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [dpadStep, setDpadStep] = useState<number>(25);

  // Keyboard text typing state
  const [inputText, setInputText] = useState<string>('');
  const [ctrlActive, setCtrlActive] = useState<boolean>(false);
  const [altActive, setAltActive] = useState<boolean>(false);
  const [shiftActive, setShiftActive] = useState<boolean>(false);
  const [superActive, setSuperActive] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(Date.now());

  // Touch tracking refs
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimer = useRef<number | undefined>(undefined);
  const touchMoved = useRef<boolean>(false);
  const lastTwoTouchY = useRef<number | null>(null);

  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/screen`;
  };

  // Screen Orientation Helpers (Auto-Landscape on Mobile)
  const requestLandscapeOrientation = async () => {
    try {
      // 1. Native Android App Bridge
      if ((window as any).AndroidBridge?.setOrientation) {
        (window as any).AndroidBridge.setOrientation('landscape');
      }
      // 2. Standard Web Screen Orientation API (Progressive Enhancement)
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
        await (window.screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore if unsupported or permissions policy restricts
    }
  };

  const unlockOrientation = () => {
    try {
      // 1. Native Android App Bridge
      if ((window as any).AndroidBridge?.setOrientation) {
        (window as any).AndroidBridge.setOrientation('portrait');
      }
      // 2. Standard Web Screen Orientation API
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        window.screen.orientation.unlock();
      }
    } catch {}
  };

  const enterFullscreenMode = () => {
    triggerHaptic(40);
    setIsFullscreen(true);
    setImmersiveMode(true);

    // Call native Android bridge for immersive status & nav bar hiding
    if ((window as any).AndroidBridge?.setFullscreen) {
      (window as any).AndroidBridge.setFullscreen(true);
    }

    // Rotate device to landscape
    requestLandscapeOrientation();

    // Standard HTML5 Fullscreen API for web browsers
    try {
      const elem = containerRef.current || document.documentElement;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any)?.webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    } catch {}
  };

  const exitFullscreenMode = () => {
    triggerHaptic(30);
    setIsFullscreen(false);
    setImmersiveMode(false);

    // Call native Android bridge to restore status & nav bars
    if ((window as any).AndroidBridge?.setFullscreen) {
      (window as any).AndroidBridge.setFullscreen(false);
    }

    // Restore portrait orientation
    unlockOrientation();

    // Exit standard HTML5 Fullscreen API
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {}
  };

  // Fullscreen toggle handler with Auto-Landscape
  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      enterFullscreenMode();
    } else {
      exitFullscreenMode();
    }
  };

  // Hardware / Gesture Back Button handling for APK & Mobile: exit fullscreen first
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      if (isFullscreen) {
        exitFullscreenMode();
        return true; // handled
      }
      return false; // let normal back navigation proceed
    });
    return () => {
      unregister();
    };
  }, [isFullscreen, registerBackHandler]);

  // Clean up fullscreen mode when leaving screen mirror view
  useEffect(() => {
    return () => {
      setImmersiveMode(false);
      if ((window as any).AndroidBridge?.setFullscreen) {
        (window as any).AndroidBridge.setFullscreen(false);
      }
      if ((window as any).AndroidBridge?.setOrientation) {
        (window as any).AndroidBridge.setOrientation('portrait');
      }
    };
  }, [setImmersiveMode]);

  // Handle ESC or external browser fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!fs && isFullscreen && !isApk) {
        setIsFullscreen(false);
        setImmersiveMode(false);
        unlockOrientation();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, isApk]);

  // Live Digital Clock for CCTV OSD
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTimeStr(now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        now.toTimeString().split(' ')[0]
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Last vibration timestamp ref
  const lastMirrorVibrateRef = useRef<number>(0);

  // Poll CCTV Status periodically
  const fetchCctvStatus = async () => {
    try {
      const status = await api.getCctvStatus();
      setCctvStatus(status);
      if (status.night_mode !== undefined) {
        setNightMode(status.night_mode);
      }
      if (status.auto_light_adjust !== undefined) {
        setAutoLightAdjust(Boolean(status.auto_light_adjust));
      }
      if (status.motion_detection_enabled !== undefined) {
        setMotionEnabled(Boolean(status.motion_detection_enabled));
      }
      if (status.motion_detected) {
        const now = Date.now();
        if (now - lastMirrorVibrateRef.current > 2500) {
          lastMirrorVibrateRef.current = now;
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([250, 100, 250, 100, 400]);
            }
          } catch {}
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchCctvStatus();
    const interval = setInterval(() => {
      if (showLaptopCam || showLaptopCamFullscreen || cctvStatus.is_recording) {
        fetchCctvStatus();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [showLaptopCam, showLaptopCamFullscreen, cctvStatus.is_recording]);

  // Live CCTV Laptop Microphone Audio Streaming Control
  useEffect(() => {
    const audio = cctvAudioRef.current;
    if (!audio) return;

    if (showLaptopCam || showLaptopCamFullscreen) {
      if (cctvAudioEnabled) {
        if (!audio.src.includes('/api/camera/laptop/audio')) {
          audio.src = `/api/camera/laptop/audio?t=${Date.now()}`;
        }
        audio.volume = cctvAudioVolume;
        audio.play().catch(() => {
          // Autoplay blocked by mobile browser until user interaction
        });
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [showLaptopCam, showLaptopCamFullscreen, cctvAudioEnabled, cctvAudioVolume]);

  const toggleCctvAudio = () => {
    const next = !cctvAudioEnabled;
    setCctvAudioEnabled(next);
    if (cctvAudioRef.current) {
      if (next) {
        cctvAudioRef.current.src = `/api/camera/laptop/audio?t=${Date.now()}`;
        cctvAudioRef.current.volume = cctvAudioVolume;
        cctvAudioRef.current.play().catch(() => {});
      } else {
        cctvAudioRef.current.pause();
      }
    }
    addNotification('CCTV Audio', next ? 'Live Microphone Audio: UNMUTED' : 'Live Microphone Audio: MUTED', 'info');
  };

  // Bandwidth & Streaming Presets (Optimized for Weak Mobile Internet & Low Latency)
  const applyBandwidthPreset = (mode: 'low' | 'balanced' | 'high') => {
    setBandwidthMode(mode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'preset', preset: mode }));
    }
    const label = mode === 'low' 
      ? '⚡ Low Internet (0.45x, 15 FPS, Fast)' 
      : mode === 'balanced' 
      ? '⚖️ Balanced (0.65x, 22 FPS)' 
      : '💎 High Quality (1.0x, 30 FPS)';
    addNotification('Stream Preset', label, 'info');
  };

  // WebSocket Screen Streaming
  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      // Send active bandwidth preset immediately on connection
      ws.send(JSON.stringify({ type: 'preset', preset: bandwidthMode }));
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data === 'string') {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'init') {
            setResolution({ width: data.width, height: data.height });
            if (data.fps) setStreamFps(data.fps);
            if (data.quality) setStreamQuality(data.quality);
            if (data.cursor) {
              setCursorPos({ x: data.cursor.x, y: data.cursor.y });
            }
          } else if (data.type === 'preset_applied') {
            if (data.fps) setStreamFps(data.fps);
            if (data.quality) setStreamQuality(data.quality);
          } else if (data.type === 'cursor') {
            setCursorPos({ x: data.x, y: data.y });
          }
        } catch {}
      } else if (evt.data instanceof ArrayBuffer) {
        const blob = new Blob([evt.data], { type: 'image/jpeg' });
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
                canvas.width = img.naturalWidth || resolution.width;
                canvas.height = img.naturalHeight || resolution.height;
              }
              ctx.drawImage(img, 0, 0);
            }
          }
          URL.revokeObjectURL(url);

          frameCountRef.current += 1;
          const now = Date.now();
          if (now - lastFpsCalcRef.current >= 1000) {
            setCurrentFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsCalcRef.current = now;
          }
        };
        img.src = url;
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleTogglePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: next ? 'pause' : 'resume' }));
    }
  };

  const handleChangeQuality = (q: number) => {
    setStreamQuality(q);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'quality', val: q }));
    }
  };

  const handleChangeFps = (f: number) => {
    setStreamFps(f);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'fps', val: f }));
    }
  };

  const getScaledCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = resolution.width / rect.width;
    const scaleY = resolution.height / rect.height;
    const x = Math.round(Math.max(0, Math.min(resolution.width, (clientX - rect.left) * scaleX)));
    const y = Math.round(Math.max(0, Math.min(resolution.height, (clientY - rect.top) * scaleY)));
    return { x, y };
  };

  const spawnTouchRipple = (clientX: number, clientY: number, isRightClick = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const rippleId = Date.now() + Math.random();
    setTouchRipples(prev => [...prev.slice(-4), { id: rippleId, x: localX, y: localY, isRightClick }]);
    setTimeout(() => {
      setTouchRipples(prev => prev.filter(r => r.id !== rippleId));
    }, 450);
  };

  // Passwordless Unlock Handler
  const handleUnlockScreen = async () => {
    try {
      if (navigator.vibrate) navigator.vibrate([25, 35, 25]);
      addNotification('Unlocking Display', 'Waking screen & dismissing screen lock without password...', 'info');
      const res = await api.unlockScreen();
      if (res.success) {
        addNotification('Screen Unlocked', 'Workstation awakened & unlocked without password!', 'success');
      } else {
        addNotification('Screen Awakened', 'Wake signal sent to workstation.', 'info');
      }
    } catch {
      addNotification('Unlock Error', 'Failed to execute unlock.', 'error');
    }
  };

  // CCTV 30-Minute Video Recording Handlers
  const handleStartCctvRecording = async () => {
    setCctvActionLoading(true);
    try {
      const res = await api.startCctvRecording(1800, true);
      addNotification('CCTV Recording Active', '30-minute rolling video recording started! Files will save and upload to Google Drive.', 'success');
      await fetchCctvStatus();
    } catch (err: any) {
      addNotification('CCTV Error', err.message || 'Failed to start CCTV recording.', 'error');
    } finally {
      setCctvActionLoading(false);
    }
  };

  const handleStopCctvRecording = async () => {
    setCctvActionLoading(true);
    try {
      const res = await api.stopCctvRecording();
      addNotification('CCTV Stopped', res.message || 'CCTV recording stopped. Video file saved.', 'info');
      await fetchCctvStatus();
    } catch {
      addNotification('CCTV Error', 'Failed to stop recording.', 'error');
    } finally {
      setCctvActionLoading(false);
    }
  };

  const handleToggleNightMode = async () => {
    const next = !nightMode;
    setNightMode(next);
    try {
      await api.updateCctvSettings({ night_mode: next });
      addNotification('Night Vision', next ? 'Low-Light Boost Activated (CLAHE)' : 'Normal Daytime Mode', 'info');
      await fetchCctvStatus();
    } catch {
      // ignore
    }
  };

  const handleToggleAlwaysRecord = async () => {
    const next = !cctvStatus.always_record;
    try {
      await api.updateCctvSettings({ always_record: next });
      setCctvStatus(prev => ({ ...prev, always_record: next }));
      addNotification('24/7 Always Record', next ? 'Always Record Enabled (24/7 Auto-Start)' : '24/7 Auto-Start Disabled', 'info');
      await fetchCctvStatus();
    } catch {
      // ignore
    }
  };

  // Two-Way Phone Camera Streaming to Kali Linux Desktop
  const startPhoneCameraStream = async (facing: 'user' | 'environment' = phoneFacingMode) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addNotification('Camera Error', 'Browser camera access not supported on this connection.', 'error');
        return;
      }
      addNotification('Camera Starting', 'Requesting phone camera permission...', 'info');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      phoneStreamRef.current = stream;

      if (phoneVideoRef.current) {
        phoneVideoRef.current.srcObject = stream;
        await phoneVideoRef.current.play().catch(() => {});
      }

      setIsPhoneCamStreaming(true);
      addNotification('Streaming to Laptop', 'Phone camera is now live on your Kali Linux laptop screen!', 'success');

      if (!hiddenCanvasRef.current) {
        hiddenCanvasRef.current = document.createElement('canvas');
      }
      const hCanvas = hiddenCanvasRef.current;
      hCanvas.width = 480;
      hCanvas.height = 360;
      const ctx = hCanvas.getContext('2d');

      if (phoneFrameTimerRef.current) clearInterval(phoneFrameTimerRef.current);
      phoneFrameTimerRef.current = window.setInterval(() => {
        const video = phoneVideoRef.current;
        if (video && video.readyState >= 2 && ctx) {
          ctx.drawImage(video, 0, 0, hCanvas.width, hCanvas.height);
          const b64 = hCanvas.toDataURL('image/jpeg', 0.55);
          api.sendPhoneCameraFrame(b64).catch(() => {});
        }
      }, 75);
    } catch (err) {
      console.error(err);
      addNotification('Camera Permission Denied', 'Please allow camera access in your mobile browser.', 'error');
      stopPhoneCameraStream();
    }
  };

  const stopPhoneCameraStream = () => {
    if (phoneFrameTimerRef.current) {
      clearInterval(phoneFrameTimerRef.current);
      phoneFrameTimerRef.current = null;
    }
    if (phoneStreamRef.current) {
      phoneStreamRef.current.getTracks().forEach(t => t.stop());
      phoneStreamRef.current = null;
    }
    if (phoneVideoRef.current) {
      phoneVideoRef.current.srcObject = null;
    }
    setIsPhoneCamStreaming(false);
    api.stopPhoneCamera().catch(() => {});
    addNotification('Phone Stream Stopped', 'Closed phone camera window on Kali laptop.', 'info');
  };

  const togglePhoneCameraStream = () => {
    if (isPhoneCamStreaming) {
      stopPhoneCameraStream();
    } else {
      startPhoneCameraStream(phoneFacingMode);
    }
  };

  const flipPhoneCamera = () => {
    const nextFacing = phoneFacingMode === 'user' ? 'environment' : 'user';
    setPhoneFacingMode(nextFacing);
    if (isPhoneCamStreaming) {
      stopPhoneCameraStream();
      setTimeout(() => {
        startPhoneCameraStream(nextFacing);
      }, 200);
    }
  };

  useEffect(() => {
    return () => {
      if (phoneFrameTimerRef.current) clearInterval(phoneFrameTimerRef.current);
      if (phoneStreamRef.current) {
        phoneStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // MOBILE TOUCH HANDLERS (Direct Touch on Mirror Screen)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchModeEnabled) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = getScaledCoordinates(touch.clientX, touch.clientY);
      touchStartPos.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      touchMoved.current = false;

      setCursorPos({ x, y });
      sendInput({ type: 'move_abs', x, y });

      if (longPressTimer.current !== undefined) clearTimeout(longPressTimer.current);
      longPressTimer.current = window.setTimeout(() => {
        if (!touchMoved.current) {
          sendInput({ type: 'click', button: 3 });
          if (navigator.vibrate) navigator.vibrate([30, 40]);
          spawnTouchRipple(touch.clientX, touch.clientY, true);
          addNotification('Right Click', 'Triggered right-click via long-press', 'info');
        }
      }, 500);
    } else if (e.touches.length === 2) {
      if (longPressTimer.current !== undefined) clearTimeout(longPressTimer.current);
      lastTwoTouchY.current = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchModeEnabled) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (touchStartPos.current) {
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        if (dx > 8 || dy > 8) {
          touchMoved.current = true;
          if (longPressTimer.current !== undefined) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = undefined;
          }
        }
      }
      const { x, y } = getScaledCoordinates(touch.clientX, touch.clientY);
      setCursorPos({ x, y });
      sendInput({ type: 'move_abs', x, y });
    } else if (e.touches.length === 2 && lastTwoTouchY.current !== null) {
      const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const deltaY = currentY - lastTwoTouchY.current;
      if (Math.abs(deltaY) > 6) {
        const scrollDirection = deltaY > 0 ? 2 : -2;
        sendInput({ type: 'scroll', delta_y: scrollDirection });
        lastTwoTouchY.current = currentY;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchModeEnabled) return;
    if (longPressTimer.current !== undefined) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }

    if (e.touches.length === 0 && touchStartPos.current && !touchMoved.current) {
      const duration = Date.now() - touchStartPos.current.time;
      if (duration < 450) {
        const { x, y } = getScaledCoordinates(touchStartPos.current.x, touchStartPos.current.y);
        setCursorPos({ x, y });
        sendInput({ type: 'move_abs', x, y });
        sendInput({ type: 'click', button: 1 });
        spawnTouchRipple(touchStartPos.current.x, touchStartPos.current.y, false);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    }
    touchStartPos.current = null;
    lastTwoTouchY.current = null;
    touchMoved.current = false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return;
    const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
    setCursorPos({ x, y });
    sendInput({ type: 'move_abs', x, y });
    const button = e.button === 2 ? 3 : (e.button === 1 ? 2 : 1);
    sendInput({ type: 'click', button });
    spawnTouchRipple(e.clientX, e.clientY, button === 3);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  // D-Pad Commands
  const handleDpad = (dir: string) => {
    sendInput({ type: 'dpad', direction: dir, step: dpadStep });
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handleMouseClick = (button: number) => {
    sendInput({ type: 'click', button });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  // Virtual Keyboard Command execution
  const handleKeySend = (key: string) => {
    const modifiers: string[] = [];
    if (ctrlActive) modifiers.push('ctrl');
    if (altActive) modifiers.push('alt');
    if (shiftActive) modifiers.push('shift');
    if (superActive) modifiers.push('super');

    sendInput({ type: 'key', key, modifiers });
    if (navigator.vibrate) navigator.vibrate(15);

    if (modifiers.length > 0) {
      setCtrlActive(false);
      setAltActive(false);
      setShiftActive(false);
      setSuperActive(false);
    }
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    sendInput({ type: 'type', text: inputText });
    sendInput({ type: 'key', key: 'Return' });
    addNotification('Typed to Kali', `Sent: "${inputText}" + Enter`, 'info');
    setInputText('');
    if (navigator.vibrate) navigator.vibrate(25);
  };

  const captureScreenshot = async () => {
    try {
      addNotification('Screenshot', 'Capturing Kali display...', 'info');
      const blob = await fetch('/api/remote/screenshot').then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kali-screen-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('Screenshot Saved', 'Full display screenshot downloaded.', 'success');
    } catch {
      addNotification('Screenshot Error', 'Failed to capture screenshot.', 'error');
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[100dvh] max-h-[100dvh] bg-black overflow-hidden flex flex-col items-center justify-center select-none ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none' : ''
      } ${isLandscapeRotated ? 'rotate-90 sm:rotate-0 transform' : ''}`}
    >
      {/* 
        =======================================================================
        TOP STREAM BAR: FIXED UI LAYOUT (No Collision, No Wrap, No Cut-Off)
        =======================================================================
      */}
      <div className="absolute top-2 left-2 right-2 z-30 pointer-events-none flex items-center justify-between gap-1 max-w-[calc(100vw-16px)]">
        {/* Connection Telemetry Badge */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-800 text-slate-300 font-mono text-[10px] shadow-lg whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-emerald-400 hidden xs:inline" title={networkLabel}>
            {networkType === 'tailscale' ? '🔒 TAILSCALE' : networkType === 'cloudflare' ? '☁️ WAN' : '📶 WI-FI'}
          </span>
          <span className="text-slate-400">{latencyMs}ms</span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-bold whitespace-nowrap">{currentFps} FPS</span>
          <span className="text-slate-600">•</span>
          <button
            onClick={() => {
              const nextMode = bandwidthMode === 'low' ? 'balanced' : bandwidthMode === 'balanced' ? 'high' : 'low';
              applyBandwidthPreset(nextMode);
            }}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 transition-colors"
            title="Click to cycle Bandwidth Mode (Low Internet / Balanced / High)"
          >
            {bandwidthMode === 'low' ? '⚡ LOW NET' : bandwidthMode === 'balanced' ? '⚖️ BALANCED' : '💎 HIGH'}
          </button>
        </div>

        {/* Action Controls Group: Compact Viewer Tools */}
        <div className="pointer-events-auto flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-full border border-slate-800 shadow-lg shrink-0">
          {/* Mouse Cursor Overlay Toggle */}
          <button
            onClick={() => setShowCursor(!showCursor)}
            className={`p-1 px-2 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 transition-colors ${
              showCursor
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400'
            }`}
            title={showCursor ? "Mouse Cursor: Visible" : "Mouse Cursor: Hidden"}
          >
            <MousePointer className="w-3 h-3" />
            <span className="hidden sm:inline">CURSOR</span>
          </button>

          {/* Touch Mode Toggle */}
          <button
            onClick={() => setTouchModeEnabled(!touchModeEnabled)}
            className={`p-1 px-2 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 transition-colors ${
              touchModeEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-900 text-slate-400'
            }`}
            title={touchModeEnabled ? 'Touch: Active' : 'Touch: Off'}
          >
            <Touchpad className="w-3 h-3" />
            <span className="hidden sm:inline">TOUCH</span>
          </button>

          {/* Fit Mode Toggle */}
          <button
            onClick={() => setFitMode(prev => prev === 'contain' ? 'original' : 'contain')}
            className={`p-1 px-1.5 rounded-full text-[10px] font-mono text-slate-300 hover:text-white shrink-0 bg-slate-900 ${
              fitMode === 'original' ? 'text-cyan-400 border border-cyan-500/40' : ''
            }`}
            title={fitMode === 'contain' ? "Aspect: Contain" : "Aspect: 1:1"}
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">{fitMode === 'contain' ? 'FIT' : '1:1'}</span>
          </button>

          {/* Auto Landscape Rotate Toggle */}
          <button
            onClick={() => {
              setIsLandscapeRotated(!isLandscapeRotated);
              requestLandscapeOrientation();
            }}
            className={`p-1 px-2 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all ${
              isLandscapeRotated ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
            title="Auto Landscape (Fill Screen)"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden xs:inline">LANDSCAPE</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono flex items-center gap-1 shrink-0 transition-all active:scale-95 ${
              isFullscreen
                ? 'bg-amber-500 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Auto-Landscape)'}
          >
            {isFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
            <span>{isFullscreen ? 'EXIT' : 'FULL'}</span>
          </button>
        </div>
      </div>

      {/* 
        =======================================================================
        DEDICATED F1-F12 FUNCTION KEYS ROW (Collapsible Floating Bar)
        =======================================================================
      */}
      {showFunctionBar && (
        <div className="absolute top-12 left-2 right-2 z-30 pointer-events-auto bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl p-1.5 shadow-2xl flex items-center gap-1 overflow-x-auto no-scrollbar animate-in slide-in-from-top-2">
          <span className="text-[10px] font-mono font-bold text-cyan-400 px-1 shrink-0">F-KEYS:</span>
          {[
            { label: 'ESC', key: 'Escape' },
            { label: 'F1', key: 'F1' },
            { label: 'F2', key: 'F2' },
            { label: 'F3', key: 'F3' },
            { label: 'F4', key: 'F4' },
            { label: 'F5', key: 'F5' },
            { label: 'F6', key: 'F6' },
            { label: 'F7', key: 'F7' },
            { label: 'F8', key: 'F8' },
            { label: 'F9', key: 'F9' },
            { label: 'F10', key: 'F10' },
            { label: 'F11', key: 'F11' },
            { label: 'F12', key: 'F12' },
            { label: 'PrtScn', key: 'Print' },
            { label: 'DEL', key: 'Delete' },
            { label: 'Alt+F4', key: 'F4', mod: ['alt'] },
            { label: 'Ctrl+C', key: 'c', mod: ['ctrl'] },
            { label: 'ENTER', key: 'Return' },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => {
                if (btn.mod) {
                  sendInput({ type: 'key', key: btn.key, modifiers: btn.mod });
                } else {
                  handleKeySend(btn.key);
                }
                if (navigator.vibrate) navigator.vibrate(15);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-200 border border-slate-800 text-xs font-mono font-bold shrink-0 shadow-sm"
            >
              {btn.label}
            </button>
          ))}
          <button
            onClick={() => setShowFunctionBar(false)}
            className="p-1 text-slate-400 hover:text-white shrink-0 ml-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real-time CCTV Laptop Microphone Audio Element */}
      <audio ref={cctvAudioRef} playsInline autoPlay className="hidden" />

      {/* 
        =======================================================================
        CAMERA 1: FULL-SCREEN CCTV MONITOR & FLOATING PiP VIEWER
        =======================================================================
      */}
      {/* 1A. FULL-SCREEN CCTV MONITOR MODE */}
      {showLaptopCamFullscreen && (
        <div
          className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in select-none ${
            isLandscapeRotated ? 'rotate-90 sm:rotate-0 transform' : ''
          }`}
        >
          {/* CCTV On-Screen Display (OSD) Header */}
          <div className="absolute top-3 left-3 right-3 z-40 flex items-center justify-between gap-2 pointer-events-none">
            {/* Timestamp & Camera Telemetry */}
            <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-2 shadow-2xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold">{liveTimeStr}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-200 font-bold">CAM-01 / KALI WEBCAM</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-cyan-400 font-bold text-[10px] hidden sm:inline">
                HD {cctvStatus.resolution || '1080p'} • {cctvStatus.fps || 30} FPS
              </span>
              {cctvStatus.night_mode && (
                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-600/40 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Moon className="w-2.5 h-2.5" /> IR NIGHT
                </span>
              )}
              {/* CCTV Live Microphone Audio Indicator */}
              <button
                onClick={toggleCctvAudio}
                className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all pointer-events-auto active:scale-95 ${
                  cctvAudioEnabled
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
                title={cctvAudioEnabled ? 'Live Mic Audio Active (Tap to Mute)' : 'Live Mic Audio Muted (Tap to Unmute)'}
              >
                {cctvAudioEnabled ? <Volume2 className="w-2.5 h-2.5 text-emerald-400" /> : <VolumeX className="w-2.5 h-2.5" />}
                <span>AUDIO: {cctvAudioEnabled ? 'LIVE' : 'MUTED'}</span>
              </button>
            </div>

            {/* Motion Detection Banner if active */}
            {cctvStatus.motion_detected && (
              <div className="pointer-events-auto bg-amber-500/90 text-slate-950 px-3 py-1 rounded-full text-xs font-mono font-black flex items-center gap-1.5 animate-bounce shadow-lg shadow-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>MOTION DETECTED</span>
              </div>
            )}

            {/* Live CCTV Recording & Google Drive Indicator */}
            <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 text-xs font-mono shadow-2xl">
              {cctvStatus.is_recording ? (
                <div className="flex items-center gap-2 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-bold">REC</span>
                  <span className="text-slate-300 font-bold">
                    {formatSeconds(cctvStatus.chunk_elapsed_sec)} / 30:00
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    <span>Auto-Drive</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  <span>STANDBY</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1 cursor-pointer" onClick={() => setGdriveModalOpen(true)}>
                    <Cloud className="w-3 h-3" />
                    <span>Google Drive</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CCTV Video Feed Surface */}
          <div className="w-full h-full flex items-center justify-center relative bg-black overflow-hidden">
            <img
              src="/api/camera/laptop/stream"
              alt="Kali Laptop Fullscreen CCTV Stream"
              className="w-full h-full object-contain pointer-events-none transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
              onError={(e) => {
                (e.target as any).src = '';
              }}
            />

            {/* Subtle Surveillance Crosshair Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
              <div className="w-16 h-16 border border-emerald-400 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-emerald-400" />
              </div>
            </div>

            {/* Overlaid Intercom Broadcast Banner */}
            {isIntercomRecording && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-rose-600 border-2 border-white text-white font-mono text-xs font-black tracking-wider flex items-center gap-2 animate-pulse shadow-2xl shadow-rose-950">
                <Mic className="w-4 h-4 animate-bounce" />
                <span>TALKING TO LAPTOP SPEAKERS...</span>
              </div>
            )}
          </div>

          {/* Floating CCTV Command HUD Bar */}
          <div className="absolute bottom-4 left-3 right-3 z-40 pointer-events-none flex justify-center">
            <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-full p-2 shadow-2xl flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
              {/* 24/7 CCTV Active Rolling Status Badge */}
              <div className="px-3 py-1.5 rounded-full bg-rose-950/90 border border-rose-500/70 text-rose-300 font-mono text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-950/50">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-black text-rose-400">24/7 CCTV</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-200">
                  {cctvStatus.is_recording
                    ? `${formatSeconds(cctvStatus.chunk_elapsed_sec)} / 30:00`
                    : 'STANDBY'}
                </span>
              </div>

              {/* Push-to-Talk / Tap-to-Talk Two-Way Intercom (Mobile -> Laptop Speakers) */}
              <button
                onClick={toggleIntercom}
                onMouseDown={startIntercom}
                onMouseUp={stopIntercom}
                onTouchStart={startIntercom}
                onTouchEnd={stopIntercom}
                onContextMenu={(e) => e.preventDefault()}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all select-none active:scale-95 ${
                  isIntercomRecording
                    ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/50'
                    : intercomStatus === 'sending'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400'
                    : intercomStatus === 'played'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400'
                    : 'bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/50 text-rose-300'
                }`}
                title="Tap once or hold to speak into mobile and broadcast on laptop speakers"
              >
                <Mic className={`w-3.5 h-3.5 ${isIntercomRecording ? 'animate-bounce' : ''}`} />
                <span>
                  {isIntercomRecording
                    ? 'REC (TAP SEND)'
                    : intercomStatus === 'sending'
                    ? 'SENDING...'
                    : intercomStatus === 'played'
                    ? 'PLAYED!'
                    : 'TALK'}
                </span>
              </button>

              {/* Motion Detection Engine Toggle */}
              <button
                onClick={handleToggleMotion}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  motionEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-500'
                }`}
                title="Toggle Motion Detection Engine ON/OFF (OFF gives zero-lag performance)"
              >
                <Radio className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">MOTION: </span>
                <span>{motionEnabled ? 'ON' : 'OFF'}</span>
              </button>



              {/* Auto Light Adjust Toggle */}
              <button
                onClick={handleToggleAutoLight}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  autoLightAdjust
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-500'
                }`}
                title="Toggle Auto Light & Dynamic Exposure Adjust (brightens shadows & balances highlights)"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AUTO LIGHT: </span>
                <span>{autoLightAdjust ? 'ON' : 'OFF'}</span>
              </button>

              {/* Live Audio Monitoring Toggle Button */}
              <button
                onClick={toggleCctvAudio}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  cctvAudioEnabled
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-black'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                }`}
                title="Toggle Real-Time Audio from Kali Laptop Microphone"
              >
                {cctvAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-slate-950" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">MIC: </span>
                <span>{cctvAudioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
              </button>

              {/* 24/7 Always Record Toggle */}
              <button
                onClick={handleToggleAlwaysRecord}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  cctvStatus.always_record
                    ? 'bg-rose-950/90 border border-rose-500 text-rose-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                }`}
                title="Toggle 24/7 Always Record Surveillance"
              >
                <Disc className={`w-3.5 h-3.5 ${cctvStatus.always_record ? 'text-rose-400 animate-spin' : ''}`} />
                <span className="hidden sm:inline">24/7: </span>
                <span>{cctvStatus.always_record ? 'ALWAYS ON' : 'OFF'}</span>
              </button>

              {/* Night Mode Toggle */}
              <button
                onClick={handleToggleNightMode}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                  nightMode
                    ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                }`}
                title="Toggle Digital IR Night Vision (Noise Cleaned + CLAHE Boost)"
              >
                <Moon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">IR NIGHT</span>
              </button>

              {/* Digital PTZ Zoom Selector */}
              <div className="flex items-center bg-slate-900 rounded-full p-0.5 border border-slate-800 text-[10px] font-mono">
                {[1.0, 1.5, 2.0, 3.0].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoomLevel(z)}
                    className={`px-2 py-1 rounded-full transition-all ${
                      zoomLevel === z
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>

              {/* Google Drive Connect & Backup Modal Trigger */}
              <button
                onClick={() => setGdriveModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95"
                title="Connect & View Google Drive CCTV Uploads"
              >
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span className="hidden lg:inline">DRIVE</span>
              </button>

              {/* Auto Landscape Rotate Toggle */}
              <button
                onClick={() => {
                  setIsLandscapeRotated(!isLandscapeRotated);
                  requestLandscapeOrientation();
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  isLandscapeRotated
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                }`}
                title="Toggle Landscape Mode"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden xs:inline">ROTATE</span>
              </button>

              {/* Snapshot Button */}
              <a
                href="/api/camera/laptop/snapshot"
                target="_blank"
                rel="noreferrer"
                download={`cctv-snapshot-${Date.now()}.jpg`}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs flex items-center gap-1.5 active:scale-95"
                title="Capture Snapshot Photo"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <span className="hidden md:inline">PHOTO</span>
              </a>

              {/* Stealth Screen Off Button */}
              <button
                onClick={handleToggleStealthScreen}
                className={`p-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  screenIsOff
                    ? 'bg-purple-600/40 text-purple-200 border border-purple-400/50'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                }`}
                title={screenIsOff ? 'Wake Laptop Screen' : 'Turn Off Laptop Screen (Stealth Mode)'}
              >
                {screenIsOff ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-purple-400" />}
                <span className="hidden md:inline">{screenIsOff ? 'WAKE' : 'SCREEN OFF'}</span>
              </button>

              {/* Exit Fullscreen (Shrink to PiP) */}
              <button
                onClick={() => {
                  setShowLaptopCamFullscreen(false);
                  unlockOrientation();
                }}
                className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-200 active:scale-95"
                title="Minimize Fullscreen"
              >
                <Minimize className="w-4 h-4" />
              </button>

              {/* Close Laptop Camera Completely */}
              <button
                onClick={() => {
                  setShowLaptopCamFullscreen(false);
                  setShowLaptopCam(false);
                  unlockOrientation();
                }}
                className="p-2 rounded-full bg-rose-950/60 hover:bg-rose-900 text-rose-300 active:scale-95"
                title="Close Camera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1B. FLOATING PiP VIEWER MODE */}
      {showLaptopCam && !showLaptopCamFullscreen && (
        <div className="absolute top-14 right-3 z-40 pointer-events-auto w-80 max-w-[90vw] bg-slate-950/95 border border-purple-500/50 rounded-3xl p-3 shadow-2xl backdrop-blur-2xl space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
            <div className="flex items-center gap-2 text-purple-400 font-mono font-bold">
              <Laptop className="w-4 h-4" />
              <span>KALI LAPTOP WEBCAM</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Expand to Fullscreen CCTV Monitor Button */}
              <button
                onClick={() => {
                  setShowLaptopCamFullscreen(true);
                  requestLandscapeOrientation();
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-cyan-400 hover:text-white"
                title="Expand to Full-Screen CCTV Monitor"
              >
                <Maximize className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowLaptopCam(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center group">
            <img
              src="/api/camera/laptop/stream"
              alt="Kali Laptop Webcam"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as any).style.display = 'none';
              }}
            />
            {/* OSD Pill */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/85 text-[10px] font-mono text-purple-400 border border-purple-500/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>/dev/video0</span>
            </div>

            {/* Fullscreen Overlay Trigger on Hover */}
            <button
              onClick={() => {
                setShowLaptopCamFullscreen(true);
                requestLandscapeOrientation();
              }}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-mono font-bold gap-1 backdrop-blur-xs"
            >
              <Maximize className="w-5 h-5" />
              <span>FULL-SCREEN CCTV</span>
            </button>
          </div>

          {/* CCTV 24/7 Status & Controls Row */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between text-[11px] font-mono bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-rose-400 font-bold">24/7 CCTV</span>
              </div>
              <span className="text-emerald-400 font-bold">
                {cctvStatus.is_recording ? `${formatSeconds(cctvStatus.chunk_elapsed_sec)} / 30:00` : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleCctvAudio}
                className={`flex-1 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                  cctvAudioEnabled
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700'
                }`}
                title={cctvAudioEnabled ? 'Live Mic Audio Active (Click to Mute)' : 'Live Mic Audio Muted (Click to Unmute)'}
              >
                {cctvAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{cctvAudioEnabled ? 'AUDIO: ON' : 'AUDIO: MUTED'}</span>
              </button>

              <button
                onClick={() => setGdriveModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-mono text-[11px] flex items-center gap-1"
                title="Google Drive Cloud Settings"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Drive</span>
              </button>

              <button
                onClick={() => {
                  setShowLaptopCamFullscreen(true);
                  requestLandscapeOrientation();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 font-mono text-[11px] flex items-center gap-1"
                title="Fullscreen CCTV Mode"
              >
                <Maximize className="w-3.5 h-3.5" />
                <span>Full</span>
              </button>
            </div>

            {/* PiP Push-to-Talk Mic & Motion Bar */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={toggleIntercom}
                onMouseDown={startIntercom}
                onMouseUp={stopIntercom}
                onTouchStart={startIntercom}
                onTouchEnd={stopIntercom}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex-1 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center gap-1 transition-all select-none active:scale-95 border ${
                  isIntercomRecording
                    ? 'bg-rose-600 text-white border-white animate-pulse'
                    : 'bg-rose-950/60 hover:bg-rose-900/60 border-rose-500/40 text-rose-300'
                }`}
                title="Tap once or hold to speak on laptop speakers"
              >
                <Mic className={`w-3.5 h-3.5 ${isIntercomRecording ? 'animate-bounce' : ''}`} />
                <span>{isIntercomRecording ? 'REC (TAP SEND)' : 'TALK'}</span>
              </button>

              <button
                onClick={handleToggleMotion}
                className={`px-2 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center gap-1 border transition-all ${
                  motionEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                    : 'bg-slate-900 text-slate-500 border-slate-700'
                }`}
                title="Toggle Motion Engine (Off for Zero-Lag)"
              >
                <Radio className="w-3 h-3" />
                <span>{motionEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* PiP Auto Light Adjust Row */}
            <div className="flex items-center gap-1.5 pt-0.5">


              <button
                onClick={handleToggleAutoLight}
                className={`flex-1 py-1 rounded-xl font-mono text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  autoLightAdjust
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Toggle Auto Light Adjust"
              >
                <Sun className="w-3 h-3" />
                <span>AUTO LIGHT: {autoLightAdjust ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        =======================================================================
        CAMERA 2: PHONE CAMERA STREAMING TO KALI LAPTOP DESKTOP CONTROLLER
        =======================================================================
      */}
      {isPhoneCamStreaming && (
        <div className="absolute bottom-16 right-3 z-40 pointer-events-auto w-52 bg-slate-950/95 border border-rose-500/50 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl space-y-1.5 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between text-[11px] text-rose-400 font-mono font-bold">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>FEED TO KALI</span>
            </div>
            <button onClick={flipPhoneCamera} className="text-slate-300 hover:text-white p-0.5" title="Flip Camera">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] border border-slate-800">
            <video
              ref={phoneVideoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-300">
              {phoneFacingMode === 'user' ? 'FRONT' : 'BACK'}
            </div>
          </div>

          <button
            onClick={stopPhoneCameraStream}
            className="w-full py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95"
          >
            <span>STOP STREAMING</span>
          </button>
        </div>
      )}

      {/* 
        =======================================================================
        SCREEN MIRROR CANVAS AREA WITH TOUCH, POINTER & MOUSE CURSOR OVERLAY
        =======================================================================
      */}
      <div
        className="w-full h-full flex items-center justify-center overflow-auto touch-control-area relative"
        onContextMenu={e => e.preventDefault()}
      >
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              maxWidth: fitMode === 'contain' ? '100vw' : 'none',
              maxHeight: fitMode === 'contain' ? '100dvh' : 'none',
              objectFit: 'contain',
              cursor: touchModeEnabled ? 'crosshair' : 'default',
              touchAction: 'none'
            }}
            className="shadow-2xl border border-slate-900 transition-transform duration-75 block"
          />

          {/* Authentic Desktop Mouse Cursor Pointer */}
          {showCursor && (
            <div
              className="absolute pointer-events-none z-20 transition-all duration-75 ease-out"
              style={{
                left: `${(cursorPos.x / (resolution.width || 1)) * 100}%`,
                top: `${(cursorPos.y / (resolution.height || 1)) * 100}%`,
                transform: 'translate(-2px, -2px)'
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              >
                <path
                  d="M3 2L19 11L12 13L9 21L3 2Z"
                  fill="#ffffff"
                  stroke="#090d16"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <circle cx="5" cy="4" r="1.25" fill="#38bdf8" />
              </svg>
            </div>
          )}

          {/* Visual Touch Ripples on Tap */}
          {touchRipples.map(r => (
            <div
              key={r.id}
              style={{ left: r.x, top: r.y }}
              className={`absolute w-12 h-12 rounded-full border-2 pointer-events-none animate-touch-ripple ${
                r.isRightClick
                  ? 'border-amber-400 bg-amber-500/30'
                  : 'border-cyan-400 bg-cyan-500/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 
        =======================================================================
        FLOATING ACTION HUD (BOTTOM QUICK ACCESS PILL)
        =======================================================================
      */}
      <div className={`absolute z-30 pointer-events-none flex flex-col items-center gap-2 safe-bottom transition-all ${
        isFullscreen || immersiveMode ? 'bottom-3' : 'bottom-[4.5rem] sm:bottom-4'
      } left-2 right-2`}>
        <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-full p-1.5 shadow-2xl flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[calc(100vw-16px)]">
          {/* Toggle Mouse D-Pad */}
          <button
            onClick={() => {
              setShowDPad(!showDPad);
              setShowKeyboard(false);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
              showDPad
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
            title="Toggle Mouse D-Pad Controller"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>D-PAD</span>
          </button>

          {/* Toggle Virtual Keyboard */}
          <button
            onClick={() => {
              setShowKeyboard(!showKeyboard);
              setShowDPad(false);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 ${
              showKeyboard
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
            title="Toggle On-Screen Virtual Keyboard"
          >
            <Keyboard className="w-4 h-4" />
            <span>KEYBOARD</span>
          </button>

          {/* Dedicated F1-F12 Toggle */}
          <button
            onClick={() => setShowFunctionBar(!showFunctionBar)}
            className={`px-2.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95 ${
              showFunctionBar
                ? 'bg-cyan-500 text-slate-950 font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
            title="Toggle F1-F12 Function Keys"
          >
            <span>F1-12</span>
          </button>

          {/* Quick Passwordless Unlock Display Button */}
          <button
            onClick={handleUnlockScreen}
            className="px-2.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
            title="Unlock Screen without password"
          >
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
            <span>UNLOCK</span>
          </button>

          {/* Fullscreen CCTV Laptop Camera Mode */}
          <button
            onClick={() => {
              setShowLaptopCam(true);
              setShowLaptopCamFullscreen(true);
              requestLandscapeOrientation();
            }}
            className="px-2.5 py-1.5 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 active:scale-95 transition-all"
            title="Full-Screen CCTV Mode (Audio + 24/7 Rec)"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>CCTV</span>
          </button>

          {/* Google Drive Connect Modal */}
          <button
            onClick={() => setGdriveModalOpen(true)}
            className="p-1.5 px-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
            title="Google Drive Cloud & CCTV Sync"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>DRIVE</span>
          </button>

          {/* Phone Camera Stream Button */}
          <button
            onClick={togglePhoneCameraStream}
            className={`p-1.5 px-2.5 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all ${
              isPhoneCamStreaming ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800'
            }`}
            title="Stream Phone Camera to Laptop Screen"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">PHONE</span>
          </button>

          {/* Screenshot */}
          <button
            onClick={captureScreenshot}
            className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white shrink-0"
            title="Capture Screenshot"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* 1. MOUSE D-PAD FLOATING OVERLAY */}
        {showDPad && (
          <div className="pointer-events-auto w-full max-w-sm bg-cyber-surface/95 border border-cyan-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl space-y-2.5 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs">
              <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold">
                <Gamepad2 className="w-4 h-4" />
                <span>MOUSE D-PAD CONTROLLER</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                  <span>Step:</span>
                  {[10, 25, 50].map(s => (
                    <button
                      key={s}
                      onClick={() => setDpadStep(s)}
                      className={`px-1.5 py-0.5 rounded ${
                        dpadStep === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDPad(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-around pt-1">
              <div className="grid grid-cols-3 gap-1 w-32 h-32">
                <button
                  onClick={() => handleDpad('up-left')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-400 text-xs rounded-lg flex items-center justify-center font-bold"
                >
                  ↖
                </button>
                <button
                  onClick={() => handleDpad('up')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDpad('up-right')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-400 text-xs rounded-lg flex items-center justify-center font-bold"
                >
                  ↗
                </button>

                <button
                  onClick={() => handleDpad('left')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMouseClick(1)}
                  className="bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black rounded-lg flex items-center justify-center text-xs shadow-md shadow-cyan-500/30"
                  title="Center Left Click"
                >
                  OK
                </button>
                <button
                  onClick={() => handleDpad('right')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDpad('down-left')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-400 text-xs rounded-lg flex items-center justify-center font-bold"
                >
                  ↙
                </button>
                <button
                  onClick={() => handleDpad('down')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-200 rounded-lg flex items-center justify-center font-bold"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDpad('down-right')}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 text-slate-400 text-xs rounded-lg flex items-center justify-center font-bold"
                >
                  ↘
                </button>
              </div>

              <div className="flex flex-col gap-1.5 w-24">
                <button
                  onClick={() => handleMouseClick(1)}
                  className="py-2.5 rounded-xl bg-cyan-600/30 border border-cyan-500/50 hover:bg-cyan-500 text-cyan-300 font-bold text-xs active:scale-95"
                >
                  LEFT
                </button>
                <button
                  onClick={() => handleMouseClick(2)}
                  className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs active:scale-95"
                >
                  MID
                </button>
                <button
                  onClick={() => handleMouseClick(3)}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold text-xs active:scale-95"
                >
                  RIGHT
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => sendInput({ type: 'scroll', delta_y: 2 })}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 active:scale-95"
                  title="Scroll Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => sendInput({ type: 'scroll', delta_y: -2 })}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 active:scale-95"
                  title="Scroll Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. VIRTUAL KEYBOARD FLOATING OVERLAY */}
        {showKeyboard && (
          <div className="pointer-events-auto w-full max-w-lg bg-cyber-surface/95 border border-cyan-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl space-y-2.5 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs">
              <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold">
                <Keyboard className="w-4 h-4" />
                <span>VIRTUAL WORKSTATION KEYBOARD</span>
              </div>
              <button
                onClick={() => setShowKeyboard(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type command / text to send to Kali..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 active:scale-95"
              >
                <span>SEND</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { label: 'ESC', key: 'Escape' },
                { label: 'TAB', key: 'Tab' },
                { label: 'ENTER', key: 'Return' },
                { label: 'BKSP', key: 'BackSpace' },
                { label: 'SPACE', key: 'space' },
                { label: 'SUPER', key: 'Super_L' },
              ].map(k => (
                <button
                  key={k.label}
                  onClick={() => handleKeySend(k.key)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0 active:scale-95"
                >
                  {k.label}
                </button>
              ))}

              <button
                onClick={() => setCtrlActive(!ctrlActive)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shrink-0 ${
                  ctrlActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                CTRL
              </button>
              <button
                onClick={() => setAltActive(!altActive)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shrink-0 ${
                  altActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                ALT
              </button>
              <button
                onClick={() => setShiftActive(!shiftActive)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shrink-0 ${
                  shiftActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                SHIFT
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { label: 'Ctrl+C', key: 'c', mod: ['ctrl'] },
                { label: 'Ctrl+Z', key: 'z', mod: ['ctrl'] },
                { label: 'Ctrl+L (Clear)', key: 'l', mod: ['ctrl'] },
                { label: 'Ctrl+Alt+T (Term)', key: 't', mod: ['ctrl', 'alt'] },
                { label: 'Alt+Tab', key: 'Tab', mod: ['alt'] },
              ].map(c => (
                <button
                  key={c.label}
                  onClick={() => {
                    sendInput({ type: 'key', key: c.key, modifiers: c.mod });
                    if (navigator.vibrate) navigator.vibrate(15);
                  }}
                  className="px-2 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/60 hover:border-cyan-500 text-cyan-300 text-[10px] font-mono shrink-0 active:scale-95"
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-1">
                {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map(k => (
                  <button
                    key={k}
                    onClick={() => handleKeySend(k)}
                    className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono font-bold text-slate-200 active:scale-90"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 pl-2">
                <button
                  onClick={() => handleKeySend('Up')}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleKeySend('Down')}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleKeySend('Left')}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleKeySend('Right')}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. STREAM QUALITY SETTINGS POPUP */}
        {showSettings && (
          <div className="pointer-events-auto w-full max-w-sm p-3 rounded-2xl bg-slate-950/95 border border-slate-800 space-y-2 text-xs text-slate-300 animate-in fade-in shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-bold text-cyan-400">Stream Quality Settings</span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold">Network Adaptive Presets:</span>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  onClick={() => applyBandwidthPreset('low')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    bandwidthMode === 'low'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  ⚡ Low Internet (Fast)
                </button>
                <button
                  onClick={() => applyBandwidthPreset('balanced')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    bandwidthMode === 'balanced'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  ⚖️ Balanced (4G)
                </button>
                <button
                  onClick={() => applyBandwidthPreset('high')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    bandwidthMode === 'high'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  💎 High Quality
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Compression Quality ({streamQuality}%)</span>
              <input
                type="range"
                min="20"
                max="90"
                step="5"
                value={streamQuality}
                onChange={e => handleChangeQuality(Number(e.target.value))}
                className="w-32 accent-cyan-400"
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Target Framerate ({streamFps} FPS)</span>
              <div className="flex space-x-1">
                {[15, 25, 30, 60].map(f => (
                  <button
                    key={f}
                    onClick={() => handleChangeFps(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      streamFps === f ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ScreenMirrorView;
