import React, { useRef, useEffect, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2,
  Monitor, Shield, Wifi, Volume2, User
} from 'lucide-react';
import { useCall } from '../context/CallContext';

export const LaptopCallPage: React.FC = () => {
  const {
    callState,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoMuted,
    callDurationSec,
    acceptCall,
    endCall,
    toggleMicMute,
    toggleVideoMute
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Auto-answer incoming call immediately on laptop
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoJoin = params.get('auto_join') === 'true';
    if (autoJoin && (callState === 'incoming' || callState === 'idle')) {
      const timer = setTimeout(() => {
        acceptCall();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleEndCall = () => {
    endCall();
    setTimeout(() => {
      window.close();
    }, 1000);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-[#0b0f19] text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Top Header HUD (Google Meet / WhatsApp style) */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/30">
            SR
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-bold tracking-wide text-slate-100">
                Kali Linux ↔ Mobile Video Call
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5">
              <span>Duration:</span>
              <span className="text-cyan-400 font-bold">{formatDuration(callDurationSec)}</span>
              <span>•</span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <Shield className="w-3 h-3" />
                <span>WebRTC Encrypted</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>HD 1080p Ultra-Low Latency</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Video Arena */}
      <main className="relative flex-1 w-full h-full flex items-center justify-center p-4">
        {/* Remote Video (Mobile Phone Camera) */}
        <div className="relative w-full h-full max-w-7xl max-h-[82vh] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-2xl flex items-center justify-center">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover sm:object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 text-center p-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-400 animate-pulse">
                  <User className="w-12 h-12" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-400 border-4 border-slate-950 flex items-center justify-center">
                  <Volume2 className="w-3 h-3 text-slate-950" />
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-200">Connecting to Mobile Device...</h3>
                <p className="text-xs text-slate-400 font-mono">Establishing peer-to-peer WebRTC stream</p>
              </div>
            </div>
          )}

          {/* Floating Caller Name Tag */}
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-200 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mobile Device (Aryan)</span>
          </div>

          {/* Picture-in-Picture: Laptop Self Webcam Preview */}
          <div className="absolute bottom-4 right-4 z-10 w-44 sm:w-60 aspect-video rounded-2xl overflow-hidden bg-black/80 border-2 border-cyan-500/50 shadow-2xl transition-all hover:scale-105">
            {localStream && !isVideoMuted ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 text-xs font-mono space-y-1">
                <VideoOff className="w-5 h-5 text-rose-400" />
                <span>Camera Muted</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-cyan-300">
              Kali Webcam {isMicMuted && '• 🔇'}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Control Bar (Google Meet / WhatsApp Pill Style) */}
      <footer className="relative z-20 flex items-center justify-center pb-8 pt-2">
        <div className="flex items-center space-x-3 sm:space-x-4 px-6 py-3 rounded-full bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 shadow-2xl shadow-black/80">
          {/* Mic Toggle */}
          <button
            onClick={toggleMicMute}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-md ${
              isMicMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideoMute}
            className={`p-3.5 rounded-full transition-all active:scale-95 shadow-md ${
              isVideoMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'
            }`}
            title={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm tracking-wider flex items-center space-x-2 shadow-xl shadow-rose-600/40 transition-all active:scale-95"
            title="End Video Call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">END CALL</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
