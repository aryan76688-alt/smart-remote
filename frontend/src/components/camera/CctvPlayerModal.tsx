import React, { useRef, useState, useEffect } from 'react';
import {
  X, Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize, Download, Cloud, Film, Gauge
} from 'lucide-react';
import { api } from '../../services/api';

interface CctvPlayerModalProps {
  filename: string | null;
  recordingItem?: any;
  onClose: () => void;
}

export const CctvPlayerModal: React.FC<CctvPlayerModalProps> = ({
  filename,
  recordingItem,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  if (!filename) return null;

  const videoUrl = api.getCctvVideoStreamUrl(filename);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const speedOptions = [0.5, 1.0, 1.5, 2.0, 4.0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl bg-cyber-surface border border-cyan-500/40 rounded-3xl p-4 shadow-2xl space-y-3 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-100 font-mono truncate">{filename}</h3>
              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>30-Min Surveillance Chunk</span>
                {recordingItem?.gdrive_uploaded && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <Cloud className="w-3 h-3" />
                      <span>Synced to Google Drive</span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 group shadow-inner">
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
                setDuration(videoRef.current.duration || 0);
              }
            }}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-cyan-500/80 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30 active:scale-95 transition-all">
                <Play className="w-7 h-7 fill-current ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Player Controls */}
        <div className="space-y-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
          {/* Seekbar */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => skipTime(-10)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Rewind 10s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => skipTime(10)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Forward 10s"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Playback Speeds */}
            <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded-xl border border-slate-800 text-[10px] font-mono">
              <Gauge className="w-3 h-3 text-slate-500 mr-0.5" />
              {speedOptions.map(rate => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-1.5 py-0.5 rounded-lg transition-all ${
                    playbackRate === rate
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Right Tools */}
            <div className="flex items-center gap-1.5">
              <a
                href={api.getCctvVideoStreamUrl(filename)}
                download={filename}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Download MP4 file"
              >
                <Download className="w-4 h-4" />
              </a>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
                title="Fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
