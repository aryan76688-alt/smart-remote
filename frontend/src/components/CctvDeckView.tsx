import React, { useState, useEffect } from 'react';
import {
  Laptop, Smartphone, Flame, Radar, RefreshCw,
  Disc, Square, Play, Download, Trash2, FolderLock, Repeat, X
} from 'lucide-react';
import { api } from '../services/api';

interface RecorderState {
  recording: boolean;
  source: 'laptop' | 'mobile';
  filename: string | null;
  elapsed_seconds: number;
  max_seconds: number;
  remaining_seconds: number;
  progress_percent: number;
  frames_written: number;
  continuous_loop: boolean;
}

interface RecordingClip {
  filename: string;
  source: string;
  size_mb: number;
  created_at: string;
  is_active: boolean;
  stream_url: string;
  download_url: string;
}

const formatClock = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const CctvDeckView: React.FC = () => {
  const [activeFeed, setActiveFeed] = useState<'laptop' | 'mobile'>('laptop');
  const [thermal, setThermal] = useState(false);
  const [tripwire, setTripwire] = useState(false);
  const [continuousLoop, setContinuousLoop] = useState(false);
  const [feedKey, setFeedKey] = useState(Date.now());
  const [playingClip, setPlayingClip] = useState<RecordingClip | null>(null);
  const [busy, setBusy] = useState(false);

  const [recorder, setRecorder] = useState<RecorderState>({
    recording: false,
    source: 'laptop',
    filename: null,
    elapsed_seconds: 0,
    max_seconds: 1800,
    remaining_seconds: 1800,
    progress_percent: 0,
    frames_written: 0,
    continuous_loop: false
  });
  const [recordings, setRecordings] = useState<RecordingClip[]>([]);

  // On-demand Mobile CCTV signaling (only active when viewing Mobile CCTV or recording mobile)
  useEffect(() => {
    if (activeFeed === 'mobile') {
      api.toggleMobileCctv(true);
    } else if (!(recorder.recording && recorder.source === 'mobile')) {
      api.toggleMobileCctv(false);
    }

    return () => {
      if (!(recorder.recording && recorder.source === 'mobile')) {
        api.toggleMobileCctv(false);
      }
    };
  }, [activeFeed]);

  // Poll 30-Minute Recorder status & Recordings Vault
  const refreshRecordings = async () => {
    try {
      const res = await api.listRecordings();
      if (res.success) {
        setRecordings(res.recordings || []);
        if (res.recorder) setRecorder(res.recorder);
      }
    } catch (_e) {}
  };

  useEffect(() => {
    refreshRecordings();
    const timer = setInterval(refreshRecordings, 1500);
    return () => clearInterval(timer);
  }, []);

  const handleThermalToggle = async () => {
    const next = !thermal;
    setThermal(next);
    await api.toggleThermal(next);
    setFeedKey(Date.now());
  };

  const handleTripwireToggle = async () => {
    const next = !tripwire;
    setTripwire(next);
    await api.configureTripwire(next);
  };

  const handleRecordToggle = async () => {
    setBusy(true);
    try {
      if (recorder.recording) {
        await api.stopRecording();
      } else {
        await api.startRecording(activeFeed, 30, continuousLoop);
      }
      await refreshRecordings();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClip = async (filename: string) => {
    await api.deleteRecording(filename);
    if (playingClip?.filename === filename) setPlayingClip(null);
    await refreshRecordings();
  };

  const streamUrl = activeFeed === 'laptop'
    ? `${window.location.origin}/api/cctv/laptop/stream.mjpg?t=${feedKey}`
    : `${window.location.origin}/api/cctv/mobile/stream.mjpg?t=${feedKey}`;

  // SVG Ring math (radius 42 -> circumference = 2 * PI * 42 = 263.89)
  const circumference = 263.89;
  const dashOffset = circumference * (1 - Math.min(100, recorder.progress_percent) / 100);
  const totalMb = recordings.reduce((acc, r) => acc + (r.size_mb || 0), 0).toFixed(1);

  return (
    <div className="w-full h-full overflow-y-auto px-3 pb-6 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-3">

        {/* Main Stitch Crystal CCTV & 30-Minute Recorder Enclosure */}
        <div className="liquid-glass rounded-3xl p-3.5 flex flex-col gap-3.5">

          {/* Camera Pill Switcher & Stream Status */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex p-1 liquid-glass-deep rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setActiveFeed('laptop')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeFeed === 'laptop'
                    ? 'bg-stitch-primaryStrong/30 border border-stitch-primary/40 text-stitch-primary shadow-[0_0_15px_rgba(62,144,255,0.3)]'
                    : 'text-stitch-muted hover:text-stitch-text'
                }`}
              >
                <Laptop size={14} />
                <span>Laptop Cam</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFeed('mobile')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeFeed === 'mobile'
                    ? 'bg-stitch-tertiaryStrong/30 border border-stitch-tertiary/40 text-stitch-tertiary shadow-[0_0_15px_rgba(200,99,251,0.3)]'
                    : 'text-stitch-muted hover:text-stitch-text'
                }`}
              >
                <Smartphone size={14} />
                <span>Mobile CCTV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFeedKey(Date.now())}
              aria-label="Refresh CCTV stream"
              className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-muted"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Spatial Live Camera Viewport */}
          <div className="relative w-full h-60 rounded-2xl overflow-hidden bg-black/70 border border-white/15 shadow-2xl">
            <img
              key={feedKey}
              src={streamUrl}
              alt="Live pearOS CCTV Feed"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='%230b0e18'/><text x='50%' y='50%' fill='%238b91a0' font-family='monospace' font-size='15' text-anchor='middle'>Awaiting CCTV Video Feed...</text></svg>";
              }}
            />

            {/* Top HUD Scrim */}
            <div className="absolute top-0 inset-x-0 p-2.5 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15">
                <span className={`w-2 h-2 rounded-full ${recorder.recording ? 'bg-stitch-errorStrong animate-ping' : 'bg-stitch-secondary animate-pulse'}`} />
                <span className={`font-mono text-[10px] font-bold tracking-wider ${recorder.recording ? 'text-stitch-error' : 'text-stitch-secondary'}`}>
                  {recorder.recording ? `REC • ${formatClock(recorder.elapsed_seconds)}` : activeFeed === 'laptop' ? 'CAM 01 • LIVE' : 'MOBILE 02 • LIVE'}
                </span>
              </div>

              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-stitch-primaryStrong/25 border border-stitch-primary/30 text-stitch-primary backdrop-blur-md">
                H.264 MP4
              </span>
            </div>

            {/* Optical Reticle Corners */}
            <div className="absolute inset-x-10 inset-y-10 pointer-events-none flex flex-col justify-between opacity-50">
              <div className="flex justify-between">
                <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-stitch-primary rounded-tl-sm" />
                <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-stitch-primary rounded-tr-sm" />
              </div>
              <div className="flex justify-between">
                <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-stitch-primary rounded-bl-sm" />
                <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-stitch-primary rounded-br-sm" />
              </div>
            </div>

            {/* Laser Tripwire Overlay */}
            {tripwire && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <div className="w-full h-0.5 bg-stitch-errorStrong shadow-[0_0_16px_#ff3b30] animate-pulse" />
                <span className="absolute bg-stitch-errorContainer/90 border border-stitch-error/50 text-stitch-error text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                  Tripwire Armed
                </span>
              </div>
            )}

            {/* Bottom HUD Toggles */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleThermalToggle}
                  className={`px-2.5 py-1.5 rounded-full backdrop-blur-md text-[10px] font-mono font-semibold flex items-center gap-1 border transition-all active:scale-95 ${
                    thermal
                      ? 'bg-stitch-tertiaryStrong/40 border-stitch-tertiary/60 text-stitch-tertiary shadow-[0_0_12px_rgba(200,99,251,0.4)]'
                      : 'bg-black/50 border-white/15 text-stitch-muted'
                  }`}
                >
                  <Flame size={12} />
                  <span>Thermal: {thermal ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTripwireToggle}
                  className={`px-2.5 py-1.5 rounded-full backdrop-blur-md text-[10px] font-mono font-semibold flex items-center gap-1 border transition-all active:scale-95 ${
                    tripwire
                      ? 'bg-stitch-secondaryStrong/35 border-stitch-secondary/60 text-stitch-secondary shadow-[0_0_12px_rgba(71,226,102,0.4)]'
                      : 'bg-black/50 border-white/15 text-stitch-muted'
                  }`}
                >
                  <Radar size={12} />
                  <span>Tripwire: {tripwire ? 'ARMED' : 'OFF'}</span>
                </button>
              </div>

              <span className="font-mono text-[9px] text-stitch-secondary/90 bg-black/50 px-2 py-1 rounded-full border border-white/10">
                Lockscreen OK
              </span>
            </div>
          </div>

          {/* 30-Minute CCTV Recording Controller (Stitch Ring Design) */}
          <div className="liquid-glass-deep rounded-2xl p-4 flex flex-col items-center gap-3">
            <div className="flex items-center justify-between w-full">
              <div>
                <h3 className="font-display font-bold text-sm text-stitch-text">
                  30-Minute CCTV Recorder
                </h3>
                <p className="text-[11px] text-stitch-muted">
                  {recorder.recording
                    ? `Recording ${recorder.source.toUpperCase()} • ${recorder.frames_written} frames`
                    : `Target: ${activeFeed === 'laptop' ? 'Laptop Webcam' : 'Mobile Phone CCTV'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContinuousLoop(!continuousLoop)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1 border transition-all ${
                  continuousLoop || recorder.continuous_loop
                    ? 'bg-stitch-primaryStrong/25 border-stitch-primary/50 text-stitch-primary'
                    : 'bg-white/5 border-white/10 text-stitch-outline'
                }`}
              >
                <Repeat size={11} />
                <span>Auto-Loop</span>
              </button>
            </div>

            {/* Liquid Glow Circular 30:00 Progress Ring Button */}
            <div className="relative flex items-center justify-center my-1">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth="4.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke={recorder.recording ? '#ff3b30' : '#aac7ff'}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={recorder.recording ? dashOffset : circumference}
                  className="transition-all duration-700"
                  style={{
                    filter: recorder.recording ? 'drop-shadow(0 0 8px rgba(255,59,48,0.85))' : 'none'
                  }}
                />
              </svg>

              <button
                type="button"
                disabled={busy}
                onClick={handleRecordToggle}
                className={`absolute w-28 h-28 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border ${
                  recorder.recording
                    ? 'bg-gradient-to-tr from-stitch-errorContainer via-red-600/40 to-white/15 border-stitch-error/50 shadow-[0_0_35px_rgba(255,59,48,0.45)]'
                    : 'bg-gradient-to-tr from-stitch-primaryStrong/30 via-white/10 to-white/15 border-white/25 shadow-[0_0_25px_rgba(62,144,255,0.28)]'
                }`}
              >
                {recorder.recording ? (
                  <>
                    <Square size={22} className="text-stitch-error fill-stitch-error animate-pulse" />
                    <span className="font-mono font-bold text-base text-white tracking-wider mt-0.5">
                      {formatClock(recorder.elapsed_seconds)}
                    </span>
                    <span className="font-mono text-[9px] text-stitch-error uppercase tracking-widest">
                      STOP • 30:00
                    </span>
                  </>
                ) : (
                  <>
                    <Disc size={26} className="text-stitch-errorStrong drop-shadow-[0_0_10px_rgba(255,59,48,0.7)]" />
                    <span className="font-display font-bold text-xs text-white mt-0.5">
                      REC 30 MIN
                    </span>
                    <span className="font-mono text-[9px] text-stitch-primary uppercase tracking-wider">
                      TAP TO START
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-stitch-muted">
              <span>Remaining: <strong className="font-mono text-stitch-text">{formatClock(recorder.remaining_seconds)}</strong></span>
              <span className="font-mono text-stitch-secondary">H.264 Stream Pipe</span>
            </div>
          </div>
        </div>

        {/* Recordings Vault (Saved 30-Min MP4 Clips) */}
        <div className="liquid-glass rounded-3xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderLock size={17} className="text-stitch-primary" />
              <h4 className="font-display font-bold text-sm text-stitch-text">
                Recordings Vault (30m Clips)
              </h4>
            </div>
            <span className="font-mono text-[10px] px-2.5 py-1 rounded-full liquid-glass-deep text-stitch-muted">
              {recordings.length} Clips • {totalMb} MB
            </span>
          </div>

          {recordings.length === 0 ? (
            <div className="liquid-glass-deep rounded-2xl py-6 px-4 text-center text-xs text-stitch-outline">
              No recordings yet. Tap <strong className="text-stitch-text">REC 30 MIN</strong> above to start a background 30-minute CCTV clip.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recordings.map((clip) => (
                <div
                  key={clip.filename}
                  className="liquid-glass-deep rounded-2xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      clip.source === 'mobile'
                        ? 'bg-stitch-tertiaryStrong/20 border-stitch-tertiary/30 text-stitch-tertiary'
                        : 'bg-stitch-primaryStrong/20 border-stitch-primary/30 text-stitch-primary'
                    }`}>
                      {clip.source === 'mobile' ? <Smartphone size={18} /> : <Laptop size={18} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs text-stitch-text truncate">{clip.filename}</span>
                      <span className="font-mono text-[10px] text-stitch-outline">
                        {clip.created_at} • {clip.size_mb} MB {clip.is_active ? '• LIVE' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!clip.is_active && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPlayingClip(clip)}
                          aria-label={`Play ${clip.filename}`}
                          className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-primary"
                        >
                          <Play size={15} />
                        </button>
                        <a
                          href={`${window.location.origin}${clip.download_url}`}
                          download
                          aria-label={`Download ${clip.filename}`}
                          className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-secondary"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteClip(clip.filename)}
                          aria-label={`Delete ${clip.filename}`}
                          className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transparent Liquid-Glass Video Playback Modal */}
      {playingClip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-stitch-text truncate">{playingClip.filename}</h4>
                <span className="font-mono text-[10px] text-stitch-outline">{playingClip.created_at} • {playingClip.size_mb} MB</span>
              </div>
              <button
                type="button"
                onClick={() => setPlayingClip(null)}
                aria-label="Close video player"
                className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-text"
              >
                <X size={16} />
              </button>
            </div>
            <video
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl bg-black border border-white/15 max-h-80"
              src={`${window.location.origin}${playingClip.stream_url}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
