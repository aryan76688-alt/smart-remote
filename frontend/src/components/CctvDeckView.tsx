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

  const circumference = 263.89;
  const dashOffset = circumference * (1 - Math.min(100, recorder.progress_percent) / 100);
  const totalMb = recordings.reduce((acc, r) => acc + (r.size_mb || 0), 0).toFixed(1);

  return (
    <div className="w-full h-full overflow-y-auto px-3 pb-6 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-3">

        {/* Main Light Crystal CCTV & 30-Minute Recorder Enclosure */}
        <div className="liquid-glass rounded-3xl p-3.5 flex flex-col gap-3.5">

          {/* Camera Pill Switcher */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex p-1 liquid-glass-deep rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setActiveFeed('laptop')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeFeed === 'laptop'
                    ? 'bg-stitch-primaryStrong text-white shadow-[0_4px_14px_rgba(0,122,255,0.35)]'
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
                    ? 'bg-stitch-tertiaryStrong text-white shadow-[0_4px_14px_rgba(147,51,234,0.35)]'
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
          <div className="relative w-full h-60 rounded-2xl overflow-hidden bg-slate-200/80 border border-white/90 shadow-md">
            <img
              key={feedKey}
              src={streamUrl}
              alt="Live pearOS CCTV Feed"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='50%' y='50%' fill='%23475569' font-family='monospace' font-size='15' text-anchor='middle'>Awaiting CCTV Video Feed...</text></svg>";
              }}
            />

            {/* Top Light Glass HUD */}
            <div className="absolute top-0 inset-x-0 p-2.5 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-md border border-white/90 shadow-sm">
                <span className={`w-2 h-2 rounded-full ${recorder.recording ? 'bg-stitch-errorStrong animate-ping' : 'bg-stitch-secondaryStrong animate-pulse'}`} />
                <span className={`font-mono text-[10px] font-bold tracking-wider ${recorder.recording ? 'text-stitch-error' : 'text-stitch-secondary'}`}>
                  {recorder.recording ? `REC • ${formatClock(recorder.elapsed_seconds)}` : activeFeed === 'laptop' ? 'CAM 01 • LIVE' : 'MOBILE 02 • LIVE'}
                </span>
              </div>

              <span className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-white/80 border border-white/90 text-stitch-primary font-semibold backdrop-blur-md shadow-sm">
                H.264 MP4
              </span>
            </div>

            {/* Optical Reticle Corners */}
            <div className="absolute inset-x-10 inset-y-10 pointer-events-none flex flex-col justify-between opacity-70">
              <div className="flex justify-between">
                <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-stitch-primaryStrong rounded-tl-sm" />
                <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-stitch-primaryStrong rounded-tr-sm" />
              </div>
              <div className="flex justify-between">
                <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-stitch-primaryStrong rounded-bl-sm" />
                <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-stitch-primaryStrong rounded-br-sm" />
              </div>
            </div>

            {/* Laser Tripwire Overlay */}
            {tripwire && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <div className="w-full h-0.5 bg-stitch-errorStrong shadow-[0_0_14px_#ef4444] animate-pulse" />
                <span className="absolute bg-white/90 border border-red-300 text-stitch-error text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow">
                  Tripwire Armed
                </span>
              </div>
            )}

            {/* Bottom Light Glass HUD Toggles */}
            <div className="absolute bottom-0 inset-x-0 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleThermalToggle}
                  className={`px-2.5 py-1.5 rounded-full backdrop-blur-md text-[10px] font-mono font-bold flex items-center gap-1 border transition-all active:scale-95 shadow-sm ${
                    thermal
                      ? 'bg-stitch-tertiaryStrong text-white border-purple-400'
                      : 'bg-white/80 border-white/90 text-stitch-text'
                  }`}
                >
                  <Flame size={12} />
                  <span>Thermal: {thermal ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTripwireToggle}
                  className={`px-2.5 py-1.5 rounded-full backdrop-blur-md text-[10px] font-mono font-bold flex items-center gap-1 border transition-all active:scale-95 shadow-sm ${
                    tripwire
                      ? 'bg-stitch-secondaryStrong text-white border-emerald-400'
                      : 'bg-white/80 border-white/90 text-stitch-text'
                  }`}
                >
                  <Radar size={12} />
                  <span>Tripwire: {tripwire ? 'ARMED' : 'OFF'}</span>
                </button>
              </div>

              <span className="font-mono text-[9px] font-semibold text-stitch-secondary bg-white/85 px-2 py-1 rounded-full border border-white/90 shadow-sm">
                Lockscreen OK
              </span>
            </div>
          </div>

          {/* 30-Minute CCTV Recording Controller */}
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
                    ? 'bg-stitch-primaryStrong text-white border-blue-400 shadow-sm'
                    : 'bg-white/70 border-slate-900/10 text-stitch-muted'
                }`}
              >
                <Repeat size={11} />
                <span>Auto-Loop</span>
              </button>
            </div>

            {/* Light Liquid Glow Circular 30:00 Progress Ring Button */}
            <div className="relative flex items-center justify-center my-1">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="rgba(15, 23, 42, 0.10)"
                  strokeWidth="4.5"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke={recorder.recording ? '#ef4444' : '#007AFF'}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={recorder.recording ? dashOffset : circumference}
                  className="transition-all duration-700"
                  style={{
                    filter: recorder.recording ? 'drop-shadow(0 0 6px rgba(239,68,68,0.65))' : 'none'
                  }}
                />
              </svg>

              <button
                type="button"
                disabled={busy}
                onClick={handleRecordToggle}
                className={`absolute w-28 h-28 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border ${
                  recorder.recording
                    ? 'bg-gradient-to-tr from-red-500 to-rose-400 text-white border-red-200 shadow-[0_10px_30px_rgba(239,68,68,0.40)]'
                    : 'bg-gradient-to-tr from-white/95 via-white/80 to-sky-50/90 text-stitch-text border-white shadow-[0_10px_28px_rgba(0,122,255,0.16)]'
                }`}
              >
                {recorder.recording ? (
                  <>
                    <Square size={22} className="text-white fill-white animate-pulse" />
                    <span className="font-mono font-bold text-base text-white tracking-wider mt-0.5">
                      {formatClock(recorder.elapsed_seconds)}
                    </span>
                    <span className="font-mono text-[9px] text-white/90 uppercase tracking-widest">
                      STOP • 30:00
                    </span>
                  </>
                ) : (
                  <>
                    <Disc size={26} className="text-stitch-errorStrong" />
                    <span className="font-display font-bold text-xs text-stitch-text mt-0.5">
                      REC 30 MIN
                    </span>
                    <span className="font-mono text-[9px] text-stitch-primary font-semibold uppercase tracking-wider">
                      TAP TO START
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-white/65 border border-slate-900/10 text-stitch-muted">
              <span>Remaining: <strong className="font-mono text-stitch-text">{formatClock(recorder.remaining_seconds)}</strong></span>
              <span className="font-mono text-stitch-secondary font-semibold">H.264 Stream Pipe</span>
            </div>
          </div>
        </div>

        {/* Recordings Vault (Saved 30-Min MP4 Clips) */}
        <div className="liquid-glass rounded-3xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderLock size={17} className="text-stitch-primaryStrong" />
              <h4 className="font-display font-bold text-sm text-stitch-text">
                Recordings Vault (30m Clips)
              </h4>
            </div>
            <span className="font-mono text-[10px] px-2.5 py-1 rounded-full liquid-glass-deep text-stitch-muted font-semibold">
              {recordings.length} Clips • {totalMb} MB
            </span>
          </div>

          {recordings.length === 0 ? (
            <div className="liquid-glass-deep rounded-2xl py-6 px-4 text-center text-xs text-stitch-muted">
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
                        ? 'bg-purple-500/15 border-purple-500/25 text-stitch-tertiary'
                        : 'bg-blue-500/15 border-blue-500/25 text-stitch-primary'
                    }`}>
                      {clip.source === 'mobile' ? <Smartphone size={18} /> : <Laptop size={18} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-semibold text-stitch-text truncate">{clip.filename}</span>
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
                          className="w-9 h-9 rounded-full liquid-btn flex items-center justify-center text-stitch-primaryStrong"
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

      {/* Light Transparent Liquid-Glass Video Playback Modal */}
      {playingClip && (
        <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-stitch-text truncate">{playingClip.filename}</h4>
                <span className="font-mono text-[10px] text-stitch-muted">{playingClip.created_at} • {playingClip.size_mb} MB</span>
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
              className="w-full rounded-2xl bg-slate-900 border border-white/80 max-h-80 shadow-md"
              src={`${window.location.origin}${playingClip.stream_url}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
