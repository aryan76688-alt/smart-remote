import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, X, Radio, Activity,
  Play, Square, AlertCircle, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

interface MicMonitorHudProps {
  device: {
    id: string;
    name: string;
    model: string;
    role: 'laptop' | 'mobile';
  };
  onClose: () => void;
}

export const MicMonitorHud: React.FC<MicMonitorHudProps> = ({ device, onClose }) => {
  const isMobile = device.role === 'mobile';
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [micActive, setMicActive] = useState<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const streamUrl = isMobile
    ? `/api/camera/phone/audio-stream?t=${streamKey}`
    : `/api/camera/laptop/audio?t=${streamKey}`;

  // Start audio on mount
  useEffect(() => {
    if (isMobile) {
      // Proactively ensure mobile mic streaming is commanded
      api.controlPhoneCamera('start_mic').catch(() => {});
    }

    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
      audio.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch((err) => {
        console.warn('Audio autoplay blocked, awaiting interaction:', err);
        setAutoplayBlocked(true);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (isMobile) {
        api.controlPhoneCamera('stop_mic').catch(() => {});
      }
    };
  }, [isMobile, streamKey]);

  // Volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : val;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.volume = next ? 0 : volume;
    }
  };

  const handleManualPlay = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
  };

  const handleToggleMic = async () => {
    if (!isMobile) return;
    if (micActive) {
      await api.controlPhoneCamera('stop_mic').catch(() => {});
      setMicActive(false);
      setIsPlaying(false);
    } else {
      await api.controlPhoneCamera('start_mic').catch(() => {});
      setMicActive(true);
      setStreamKey(Date.now());
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 animate-in slide-in-from-bottom-6 duration-300 max-w-sm w-full select-none">
      <div className="bg-[#090d16]/95 border border-cyan-500/50 rounded-2xl p-4 shadow-[0_0_40px_rgba(0,240,255,0.2)] backdrop-blur-xl flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Mic className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  {isMobile ? 'OPPO PHONE MIC' : 'KALI LAPTOP MIC'}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  LIVE MP3
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {device.name} • {device.model}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setStreamKey(Date.now())}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-colors"
              title="Reconnect Audio"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
              title="Stop Audio Monitoring"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visualizer Waveform Animation */}
        <div className="bg-[#050811] rounded-xl p-3 border border-slate-800/80 flex items-center justify-between gap-1 h-12 overflow-hidden px-4">
          {[40, 65, 85, 30, 95, 50, 75, 90, 45, 60, 80, 35].map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                isPlaying && !isMuted
                  ? 'bg-gradient-to-t from-cyan-500 to-emerald-400 animate-pulse'
                  : 'bg-slate-800'
              }`}
              style={{
                height: isPlaying && !isMuted ? `${height}%` : '20%',
                animationDelay: `${i * 75}ms`
              }}
            />
          ))}
        </div>

        {/* Autoplay blocked notification */}
        {autoplayBlocked && (
          <button
            onClick={handleManualPlay}
            className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-amber-300 font-mono text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>Click to Unmute Live Audio</span>
          </button>
        )}

        {/* Audio Controls */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-1">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition-colors ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] text-slate-400 w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>

          {isMobile && (
            <button
              onClick={handleToggleMic}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
                micActive
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                  : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
              }`}
            >
              {micActive ? 'MUTE PHONE' : 'UNMUTE PHONE'}
            </button>
          )}
        </div>

        {/* Hidden Audio Stream Element */}
        <audio
          ref={audioRef}
          src={streamUrl}
          autoPlay
          playsInline
          preload="auto"
          onPlay={() => {
            setIsPlaying(true);
            setAutoplayBlocked(false);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            console.warn('Audio stream error, retrying...');
            setTimeout(() => setStreamKey(Date.now()), 2000);
          }}
        />
      </div>
    </div>
  );
};
