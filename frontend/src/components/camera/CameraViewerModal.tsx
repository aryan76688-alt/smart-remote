import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, X, RefreshCw, Maximize2, Minimize2, Download,
  Flashlight, SwitchCamera, Play, Square, Activity, ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api';

interface CameraViewerModalProps {
  device: {
    id: string;
    name: string;
    model: string;
    role: 'laptop' | 'mobile';
  };
  onClose: () => void;
}

export const CameraViewerModal: React.FC<CameraViewerModalProps> = ({ device, onClose }) => {
  const isMobile = device.role === 'mobile';
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState<{
    camera_active: boolean;
    audio_active?: boolean;
    fps: number;
    facing?: string;
    torch?: boolean;
  }>({
    camera_active: false,
    audio_active: false,
    fps: 0,
    facing: 'user',
    torch: false
  });
  const [streamError, setStreamError] = useState<boolean>(false);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Poll phone camera status when inspecting mobile device
  useEffect(() => {
    if (!isMobile) return;
    let mounted = true;

    const pollStatus = async () => {
      try {
        const status = await api.getPhoneCameraStatus();
        if (mounted) {
          setMobileStatus(status);
          if (status.camera_active) {
            setStreamError(false);
          }
        }
      } catch {
        // ignore network error
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isMobile]);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Snapshot Capture
  const captureSnapshot = () => {
    if (!imgRef.current) return;
    try {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${device.name.toLowerCase().replace(/\s+/g, '_')}_snapshot_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    }
  };

  // Mobile Remote Controls
  const handleControl = async (action: 'flip_camera' | 'toggle_torch' | 'start_camera' | 'stop_camera') => {
    setActionLoading(action);
    try {
      await api.controlPhoneCamera(action);
      // Wait for device to process command
      setTimeout(async () => {
        const status = await api.getPhoneCameraStatus().catch(() => null);
        if (status) setMobileStatus(status);
        setStreamKey(Date.now());
        setActionLoading(null);
      }, 700);
    } catch (err) {
      console.error('Camera control failed:', err);
      setActionLoading(null);
    }
  };

  const streamSrc = isMobile
    ? `/api/camera/phone/stream?t=${streamKey}`
    : `/api/camera/laptop/stream?t=${streamKey}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in">
      <div
        ref={modalContainerRef}
        className={`w-full max-w-4xl bg-[#090d16] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col ${
          isFullscreen ? 'h-full max-w-none rounded-none' : 'max-h-[92vh]'
        }`}
      >
        {/* Cockpit HUD Header */}
        <div className="px-4 py-3 bg-[#070b13] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Camera className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  {isMobile ? 'OPPO CAMERA FEED' : 'KALI WEBCAM SURVEILLANCE'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 ${
                  (!isMobile || mobileStatus.camera_active)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    (!isMobile || mobileStatus.camera_active) ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  {isMobile ? (mobileStatus.camera_active ? 'LIVE FEED' : 'STANDBY') : 'LIVE FEED'}
                </span>
                {isMobile && mobileStatus.camera_active && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {mobileStatus.fps} FPS
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {device.name} • {device.model}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStreamKey(Date.now());
                setStreamError(false);
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Reload Stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={captureSnapshot}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 transition-colors"
              title="Take Snapshot"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors ml-1"
              title="Close Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport View */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
          {/* Tactical HUD Reticle Overlay */}
          <div className="absolute inset-4 pointer-events-none border border-cyan-500/20 rounded-xl z-10 flex flex-col justify-between p-3">
            <div className="flex justify-between items-start text-[10px] font-mono text-cyan-500/70">
              <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20 backdrop-blur-sm">
                <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>REC_STREAM // 720P</span>
              </div>
              <div className="bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20 backdrop-blur-sm">
                LATENCY // ~120MS
              </div>
            </div>
            <div className="flex justify-between items-end text-[10px] font-mono text-cyan-500/70">
              <div className="bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20 backdrop-blur-sm">
                {isMobile ? `LENS: ${(mobileStatus.facing || 'USER').toUpperCase()}` : 'LENS: FIXED WEBCAM'}
              </div>
              <div className="bg-black/60 px-2 py-0.5 rounded border border-cyan-500/20 backdrop-blur-sm">
                CODEC: MJPEG
              </div>
            </div>
          </div>

          <img
            ref={imgRef}
            key={streamKey}
            src={streamSrc}
            alt="Live Camera Feed"
            className="w-full h-full object-contain max-h-[70vh]"
            onError={() => setStreamError(true)}
            onLoad={() => setStreamError(false)}
          />

          {/* Standby / Error Fallback */}
          {streamError && (
            <div className="absolute inset-0 bg-[#090d16]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <Camera className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
              <h4 className="text-sm font-mono font-bold text-slate-200">
                {isMobile ? 'PHONE CAMERA STANDBY' : 'WEBCAM UNAVAILABLE'}
              </h4>
              <p className="text-xs font-mono text-slate-400 max-w-sm mt-1">
                {isMobile
                  ? 'The camera stream on Oppo phone is currently stopped or awaiting start command.'
                  : 'Check if Kali laptop webcam is busy or camera permissions are active.'}
              </p>

              {isMobile && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleControl('start_camera')}
                    disabled={actionLoading === 'start_camera'}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-mono text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>START CAMERA ON PHONE</span>
                  </button>
                  <button
                    onClick={() => {
                      setStreamError(false);
                      setStreamKey(Date.now());
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-mono text-xs flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>RETRY</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tactical Cockpit Controls Footer */}
        <div className="px-4 py-3 bg-[#070b13] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Device Telemetry Details */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>TLS ENCRYPTED FEED</span>
            </span>
            {isMobile && (
              <>
                <span>•</span>
                <span className="text-cyan-400">
                  {mobileStatus.facing === 'environment' ? 'BACK CAMERA' : 'FRONT CAMERA'}
                </span>
                {mobileStatus.torch && (
                  <>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">TORCH ON</span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right: Remote Control Actions */}
          <div className="flex items-center gap-2">
            {isMobile ? (
              <>
                <button
                  onClick={() => handleControl('flip_camera')}
                  disabled={Boolean(actionLoading)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  title="Switch Front / Rear Camera"
                >
                  <SwitchCamera className={`w-3.5 h-3.5 text-cyan-400 ${actionLoading === 'flip_camera' ? 'animate-spin' : ''}`} />
                  <span>FLIP LENS</span>
                </button>

                <button
                  onClick={() => handleControl('toggle_torch')}
                  disabled={Boolean(actionLoading)}
                  className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 ${
                    mobileStatus.torch
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                  title="Toggle Flashlight Torch"
                >
                  <Flashlight className="w-3.5 h-3.5 text-amber-400" />
                  <span>{mobileStatus.torch ? 'TORCH ON' : 'TORCH'}</span>
                </button>

                {mobileStatus.camera_active ? (
                  <button
                    onClick={() => handleControl('stop_camera')}
                    disabled={Boolean(actionLoading)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>STOP STREAM</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleControl('start_camera')}
                    disabled={Boolean(actionLoading)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>START STREAM</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setStreamKey(Date.now())}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>REFRESH</span>
              </button>
            )}

            <button
              onClick={captureSnapshot}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SNAPSHOT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
