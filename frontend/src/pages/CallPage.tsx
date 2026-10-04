import React, { useRef, useEffect, useState } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  SwitchCamera, Laptop, Shield, Volume2, Wifi, RefreshCw,
  Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useApp } from '../context/AppContext';

export const CallPage: React.FC = () => {
  const {
    callState,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoMuted,
    callDurationSec,
    facingMode,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMicMute,
    toggleVideoMute,
    switchCameraFacing,
    initPreview,
    stopPreview
  } = useCall();

  const { triggerHaptic } = useApp();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const [pipSwapped, setPipSwapped] = useState<boolean>(false);
  const [previewActive, setPreviewActive] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Initialize camera preview when on /call page in idle state
  useEffect(() => {
    let mounted = true;
    if (callState === 'idle') {
      initPreview()
        .then((stream) => {
          if (mounted && stream) {
            setPreviewActive(true);
            setPreviewError(null);
            if (previewVideoRef.current) {
              previewVideoRef.current.srcObject = stream;
              previewVideoRef.current.play().catch(() => {});
            }
          }
        })
        .catch((err) => {
          if (mounted) {
            setPreviewError('Camera access required. Please allow camera and mic permissions.');
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [callState]);

  // Keep preview element synced with localStream in idle state
  useEffect(() => {
    if (previewVideoRef.current && localStream && callState === 'idle') {
      previewVideoRef.current.srcObject = localStream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callState]);

  // Sync connected video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callState, pipSwapped]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, callState, pipSwapped]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartCall = () => {
    triggerHaptic(50);
    startCall();
  };

  const handleEndCall = () => {
    triggerHaptic(50);
    endCall();
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CONNECTED STATE: Fullscreen Two-Way Video Call
  // ──────────────────────────────────────────────────────────────────────────
  if (callState === 'connected') {
    const mainStream = pipSwapped ? localStream : remoteStream;
    const pipStream = pipSwapped ? remoteStream : localStream;
    const isMainLocal = pipSwapped;

    return (
      <div className="relative w-full h-full flex flex-col justify-between bg-black overflow-hidden select-none">
        {/* Main Video Stream */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          {mainStream ? (
            <video
              ref={isMainLocal ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted={isMainLocal}
              className={`w-full h-full object-cover ${isMainLocal && facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 space-y-4 font-mono p-4 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-pulse">
                  <Laptop className="w-10 h-10" />
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-base font-bold text-slate-200">Kali Linux Connected</div>
              <div className="text-xs text-slate-400 font-sans max-w-xs">
                Establishing HD video stream. Direct WebRTC session active.
              </div>
            </div>
          )}
        </div>

        {/* Top Floating HUD */}
        <div className="relative z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent font-mono">
          <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-800 text-xs shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-slate-100 tracking-wider">KALI LAPTOP</span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-bold">{formatDuration(callDurationSec)}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-[11px] text-emerald-400 font-bold shadow-lg">
            <Shield className="w-3.5 h-3.5" />
            <span>P2P ENCRYPTED</span>
          </div>
        </div>

        {/* Floating Picture-in-Picture Video (Tap to swap with main) */}
        <div
          onClick={() => setPipSwapped(!pipSwapped)}
          className="absolute top-20 right-4 z-30 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-cyan-400/80 shadow-2xl bg-slate-900 cursor-pointer active:scale-95 transition-all"
          title="Tap to swap views"
        >
          {pipStream ? (
            <video
              ref={isMainLocal ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted={!isMainLocal}
              className={`w-full h-full object-cover ${!isMainLocal && facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 font-mono text-[10px]">
              <VideoOff className="w-5 h-5 mb-1 text-slate-600" />
              <span>Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-1 right-1.5 text-[8px] font-mono text-cyan-300 bg-black/70 px-1 rounded">
            SWAP
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="relative z-30 flex items-center justify-center gap-4 p-5 pb-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
          {/* Toggle Mic */}
          <button
            onClick={toggleMicMute}
            className={`p-4 rounded-full transition-all active:scale-95 shadow-xl ${
              isMicMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60'
                : 'bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideoMute}
            className={`p-4 rounded-full transition-all active:scale-95 shadow-xl ${
              isVideoMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60'
                : 'bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800'
            }`}
            title={isVideoMuted ? 'Enable Camera' : 'Disable Camera'}
          >
            {isVideoMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>

          {/* Flip Camera */}
          <button
            onClick={switchCameraFacing}
            className="p-4 rounded-full bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
            title="Flip Front / Rear Camera"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-2xl shadow-rose-600/60 transition-all active:scale-95"
            title="End Video Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CALLING STATE: Outgoing Ringing Animation
  // ──────────────────────────────────────────────────────────────────────────
  if (callState === 'calling') {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-between p-6 bg-gradient-to-b from-slate-950 via-[#0a1120] to-slate-950 font-sans select-none">
        <div className="w-full flex items-center justify-between font-mono text-xs text-slate-400 pt-2">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-cyan-400 font-bold">CONNECTING...</span>
          </span>
          <span>WebRTC P2P</span>
        </div>

        <div className="flex flex-col items-center space-y-6 my-auto text-center max-w-sm">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl bg-cyan-500/10 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-2xl shadow-cyan-500/30">
              <Laptop className="w-16 h-16 animate-pulse" />
            </div>
            <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 border-4 border-slate-950 animate-ping" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-100 tracking-wide font-mono">
              KALI LINUX WORKSTATION
            </h2>
            <p className="text-xs text-cyan-400 font-bold font-mono uppercase tracking-widest animate-pulse">
              Opening Call Window on Laptop Screen...
            </p>
            <p className="text-xs text-slate-400 leading-relaxed font-sans pt-1">
              Direct connection dispatched. The video call window will launch maximized on Kali display automatically.
            </p>
          </div>

          {/* Local Camera Preview Box */}
          {localStream && (
            <div className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-slate-700 bg-black shadow-xl">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            </div>
          )}
        </div>

        {/* Cancel Call Button */}
        <div className="w-full max-w-xs pb-6">
          <button
            onClick={handleEndCall}
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-rose-600/40 active:scale-95 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            <span>CANCEL CALL</span>
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INCOMING STATE: Incoming Ringing from Laptop
  // ──────────────────────────────────────────────────────────────────────────
  if (callState === 'incoming') {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 bg-slate-950 font-sans select-none space-y-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-pulse shadow-2xl shadow-cyan-500/50">
            <Laptop className="w-14 h-14" />
          </div>
          <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-4 border-slate-950 animate-ping" />
        </div>

        <div className="text-center space-y-2 font-mono">
          <h2 className="text-2xl font-black text-slate-100 tracking-wider">
            KALI LINUX WORKSTATION
          </h2>
          <p className="text-sm text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
            Incoming Two-Way Video Call...
          </p>
        </div>

        <div className="flex items-center justify-center gap-10 pt-4 w-full max-w-xs">
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-2 active:scale-95 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/50">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold font-mono text-rose-400">DECLINE</span>
          </button>

          <button
            onClick={acceptCall}
            className="flex flex-col items-center gap-2 active:scale-95 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/50 animate-bounce">
              <Phone className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold font-mono text-emerald-400">ANSWER</span>
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. IDLE STATE: Mobile Camera Preview & 1-Tap Call Hub
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 w-full max-w-md mx-auto p-4 flex flex-col justify-between font-sans select-none space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-wide">
              TWO-WAY VIDEO CALL
            </h1>
            <p className="text-[10px] text-slate-400 font-sans">
              Direct Peer-to-Peer HD Stream (Mobile ↔ Kali Laptop)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>LAPTOP READY</span>
        </div>
      </div>

      {/* Main Camera Preview Card */}
      <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
        {previewActive && localStream && !isVideoMuted ? (
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <VideoOff className="w-8 h-8" />
            </div>
            <div className="text-xs font-bold text-slate-400 font-mono">
              {previewError || 'Camera Preview Inactive'}
            </div>
            <button
              onClick={() => initPreview()}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ENABLE CAMERA</span>
            </button>
          </div>
        )}

        {/* Floating Camera Control Badges */}
        <div className="absolute top-3 left-3 z-10 flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{facingMode === 'user' ? 'Front Camera' : 'Rear Camera'}</span>
          </span>
        </div>

        {/* Action icons on video corner */}
        <div className="absolute bottom-3 right-3 z-10 flex items-center space-x-2">
          {/* Flip camera */}
          <button
            onClick={switchCameraFacing}
            className="p-2.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-slate-200 active:scale-95 transition-all shadow-lg"
            title="Flip Camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Toggle mic preview */}
          <button
            onClick={toggleMicMute}
            className={`p-2.5 rounded-full backdrop-blur-md border transition-all active:scale-95 shadow-lg ${
              isMicMuted
                ? 'bg-rose-500/40 border-rose-500 text-rose-300'
                : 'bg-black/70 border-white/20 text-slate-200'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Toggle video preview */}
          <button
            onClick={toggleVideoMute}
            className={`p-2.5 rounded-full backdrop-blur-md border transition-all active:scale-95 shadow-lg ${
              isVideoMuted
                ? 'bg-rose-500/40 border-rose-500 text-rose-300'
                : 'bg-black/70 border-white/20 text-slate-200'
            }`}
            title={isVideoMuted ? 'Enable Video' : 'Disable Video'}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="space-y-3 pt-1">
        <button
          onClick={handleStartCall}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-slate-950 font-black font-mono tracking-wider text-sm flex items-center justify-center space-x-2.5 shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all"
        >
          <Phone className="w-5 h-5 fill-slate-950 text-slate-950" />
          <span>START VIDEO CALL TO KALI LAPTOP</span>
        </button>

        {/* Feature summary card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-300 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero-Friction Auto Launch</span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            When you tap start, Kali Linux immediately wakes up its display, unmutes speakers, launches Chromium in fullscreen, and connects two-way audio & video without clicking anything on the laptop.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CallPage;
