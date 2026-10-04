import React, { useRef, useEffect } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  SwitchCamera, Laptop, Smartphone, Volume2, Shield
} from 'lucide-react';
import { useCall } from '../../context/CallContext';

export const VideoCallModal: React.FC = () => {
  const {
    callState,
    remoteRole,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoMuted,
    callDurationSec,
    acceptCall,
    rejectCall,
    endCall,
    toggleMicMute,
    toggleVideoMute,
    switchCameraFacing
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

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

  if (callState === 'idle') return null;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 select-none animate-in fade-in duration-300">
      {/* 
        =======================================================================
        STATE 1: INCOMING CALL SCREEN (Ringing)
        =======================================================================
      */}
      {callState === 'incoming' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-sm w-full font-mono text-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-pulse shadow-2xl shadow-cyan-500/40">
              <Laptop className="w-12 h-12" />
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 animate-ping" />
          </div>

          <div className="space-y-2">
            <div className="text-xl font-black text-slate-100 tracking-wider">
              KALI LINUX WORKSTATION
            </div>
            <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
              Incoming Two-Way Video Call...
            </div>
          </div>

          {/* Action Buttons: Accept / Reject */}
          <div className="flex items-center justify-center gap-8 pt-6 w-full">
            <button
              onClick={rejectCall}
              className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-rose-400">DECLINE</span>
            </button>

            <button
              onClick={acceptCall}
              className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-emerald-500/50 animate-bounce">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-emerald-400">ANSWER</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        =======================================================================
        STATE 2: OUTGOING CALL SCREEN (Calling Laptop...)
        =======================================================================
      */}
      {callState === 'calling' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-sm w-full font-mono text-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 animate-pulse shadow-2xl shadow-cyan-500/40">
              <Laptop className="w-12 h-12" />
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-cyan-400 border-2 border-slate-950 animate-ping" />
          </div>

          <div className="space-y-2">
            <div className="text-xl font-black text-slate-100 tracking-wider">
              KALI LINUX WORKSTATION
            </div>
            <div className="text-xs text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
              Calling laptop speakers & display...
            </div>
          </div>

          {/* Local Camera Preview Circle */}
          {localStream && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          )}

          {/* Cancel Button */}
          <div className="pt-6">
            <button
              onClick={endCall}
              className="flex flex-col items-center gap-2 group active:scale-95 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs font-bold text-rose-400">CANCEL</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        =======================================================================
        STATE 3: CONNECTED TWO-WAY VIDEO CALL
        =======================================================================
      */}
      {callState === 'connected' && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden rounded-2xl bg-black border border-cyan-500/30">
          {/* Main Remote Video (Laptop Screen / Webcam) */}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 font-mono">
                <Laptop className="w-16 h-16 text-cyan-400 animate-pulse" />
                <div className="text-sm font-bold text-slate-200">Kali Linux Connected</div>
                <div className="text-xs text-slate-500">Awaiting remote video stream...</div>
              </div>
            )}
          </div>

          {/* Top Status HUD */}
          <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent font-mono">
            <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-100">KALI LAPTOP</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-400 font-bold">{formatDuration(callDurationSec)}</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-slate-800 text-[10px] text-emerald-400">
              <Shield className="w-3 h-3" />
              <span>E2E ENCRYPTED</span>
            </div>
          </div>

          {/* Floating Local Camera Preview (Picture-in-Picture) */}
          <div className="absolute top-16 right-4 z-20 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-cyan-400/60 shadow-2xl bg-black">
            {localStream && !isVideoMuted ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 font-mono text-[10px]">
                <VideoOff className="w-5 h-5 mb-1" />
                <span>Camera Off</span>
              </div>
            )}
          </div>

          {/* Bottom Floating Control Bar */}
          <div className="relative z-20 flex items-center justify-center gap-3 sm:gap-4 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            {/* Toggle Mic */}
            <button
              onClick={toggleMicMute}
              className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : 'bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800'
              }`}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Toggle Camera */}
            <button
              onClick={toggleVideoMute}
              className={`p-3.5 rounded-full transition-all active:scale-95 shadow-xl ${
                isVideoMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : 'bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800'
              }`}
              title={isVideoMuted ? 'Enable Camera' : 'Disable Camera'}
            >
              {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Switch Camera (Front/Back) */}
            <button
              onClick={switchCameraFacing}
              className="p-3.5 rounded-full bg-slate-900/90 text-slate-100 border border-slate-700 hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
              title="Flip Front / Rear Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>

            {/* End Call Button */}
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-2xl shadow-rose-600/50 transition-all active:scale-95"
              title="End Video Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
