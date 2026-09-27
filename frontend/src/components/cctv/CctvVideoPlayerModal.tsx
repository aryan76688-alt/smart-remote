import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, X, Download, Cloud, HardDrive,
  ExternalLink, Film, AlertCircle
} from 'lucide-react';

interface CctvVideoPlayerModalProps {
  video: {
    id: string;
    filename: string;
    stream_url: string;
    download_url: string;
    preview_url?: string;
    size_bytes?: number;
    created_at?: string;
    duration_sec?: number;
    is_cloud?: boolean;
  } | null;
  onClose: () => void;
}

export const CctvVideoPlayerModal: React.FC<CctvVideoPlayerModalProps> = ({ video, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);

    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [video?.stream_url]);

  // Keyboard shortcuts (Space = Play/Pause, Left = -10s, Right = +10s, F = Fullscreen, Esc = Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skipTime(10);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen]);

  if (!video) return null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const skipTime = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || duration, v.currentTime + seconds));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const target = parseFloat(e.target.value);
    v.currentTime = target;
    setCurrentTime(target);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (v) {
      v.volume = val;
      v.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !isMuted;
    setIsMuted(next);
    v.muted = next;
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  };

  const sizeMb = video.size_bytes ? (video.size_bytes / (1024 * 1024)).toFixed(1) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl bg-slate-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[96dvh]"
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleUserActivity}
        onTouchStart={handleUserActivity}
      >
        {/* Top Header Bar */}
        <div className={`p-3 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center space-x-2 truncate">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="truncate font-mono">
              <div className="text-xs sm:text-sm font-bold text-slate-100 truncate">{video.filename}</div>
              <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                {sizeMb && <span>{sizeMb} MB</span>}
                {video.created_at && (
                  <>
                    <span>•</span>
                    <span>{new Date(video.created_at).toLocaleString()}</span>
                  </>
                )}
                <span>•</span>
                <span className={`flex items-center space-x-1 ${video.is_cloud ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {video.is_cloud ? <Cloud className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
                  <span>{video.is_cloud ? 'Google Drive Cloud' : 'Local Workstation'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <a
              href={video.download_url}
              download
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all"
              title="Download full video file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DOWNLOAD</span>
            </a>

            {video.preview_url && (
              <a
                href={video.preview_url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
                title="Open in Google Drive Viewer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500 text-slate-300 hover:text-white transition-all"
              title="Close Player (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div
          className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[70vh] cursor-pointer"
          onClick={togglePlay}
        >
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 font-mono">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div className="text-sm font-bold text-slate-200">Unable to stream video directly in browser</div>
              <p className="text-xs text-slate-400 max-w-md">
                This recording is stored safely in Google Drive. You can download it directly or open it in the Google Drive Web Player.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={video.download_url}
                  download
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD RECORDING</span>
                </a>
                {video.preview_url && (
                  <a
                    href={video.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 border border-slate-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>OPEN DRIVE PLAYER</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={video.stream_url}
              playsInline
              preload="metadata"
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) setDuration(videoRef.current.duration);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => setHasError(true)}
              className="w-full h-full object-contain max-h-[70vh]"
            />
          )}

          {/* Central Play/Pause Animation Overlay on Click */}
          {!isPlaying && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-cyan-500/80 backdrop-blur-md text-slate-950 flex items-center justify-center shadow-2xl pl-1 animate-pulse">
                <Play className="w-8 h-8 fill-current" />
              </div>
            </div>
          )}
        </div>

        {/* Video Scrubber & Playback HUD Controls */}
        <div className={`p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2 z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-300">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || video.duration_sec || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:h-2 transition-all"
            />
            <span>{formatTime(duration || video.duration_sec || 0)}</span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 font-mono">
            {/* Play, Skip & Volume Group */}
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              <button
                onClick={togglePlay}
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-md active:scale-95"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => skipTime(-10)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center space-x-1"
                title="Rewind 10s (Left Arrow)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden xs:inline">10s</span>
              </button>

              <button
                onClick={() => skipTime(10)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center space-x-1"
                title="Fast Forward 10s (Right Arrow)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden xs:inline">10s</span>
              </button>

              {/* Volume Slider */}
              <div className="hidden sm:flex items-center space-x-1.5 pl-2 border-l border-slate-800">
                <button
                  onClick={toggleMute}
                  className="p-1 text-slate-400 hover:text-white"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            {/* Playback Speed & Fullscreen Group */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {/* Speed Buttons */}
              <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleSpeedChange(rate)}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      playbackRate === rate ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
