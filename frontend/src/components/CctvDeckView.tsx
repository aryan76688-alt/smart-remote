import React, { useState, useEffect } from 'react';
import {
  Laptop, Smartphone, Flame, Radar, RefreshCw,
  Disc, Square, Play, Download, Trash2, Repeat, X
} from 'lucide-react';
import { api } from '../services/api';

interface RecorderState {
  always_on: boolean;
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
    always_on: true,
    recording: true,
    source: 'laptop',
    filename: null,
    elapsed_seconds: 0,
    max_seconds: 1800,
    remaining_seconds: 1800,
    progress_percent: 0,
    frames_written: 0,
    continuous_loop: true
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
      if (recorder.recording && recorder.source === activeFeed) {
        await api.setAlwaysOnRecording(false, activeFeed);
      } else {
        await api.setAlwaysOnRecording(true, activeFeed);
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
    <div className="w-full h-full overflow-y-auto px-4 pb-24 pt-1">
      <div className="max-w-[980px] mx-auto flex flex-col gap-5">

        {/* Section 1: Photography-First Live CCTV Stage (Dark Tile #272729 per design.md) */}
        <section className="apple-glass-card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="type-tagline text-apple-ink">Live Surveillance</h2>
              <p className="type-caption text-apple-ink48">
                {activeFeed === 'laptop' ? 'Laptop Camera · Active' : 'Mobile Phone CCTV · Lockscreen Capable'}
              </p>
            </div>

            {/* Configurator Option Chips (design.md configurator-option-chip) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFeed('laptop')}
                className={`px-4 py-2 type-caption flex items-center gap-1.5 min-h-[40px] ${
                  activeFeed === 'laptop' ? 'apple-option-chip-selected font-semibold' : 'apple-option-chip'
                }`}
              >
                <Laptop size={14} className="text-apple-primary" />
                <span>Laptop</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFeed('mobile')}
                className={`px-4 py-2 type-caption flex items-center gap-1.5 min-h-[40px] ${
                  activeFeed === 'mobile' ? 'apple-option-chip-selected font-semibold' : 'apple-option-chip'
                }`}
              >
                <Smartphone size={14} className="text-apple-primary" />
                <span>Mobile CCTV</span>
              </button>
            </div>
          </div>

          {/* Media Stage with the single Apple Product Shadow */}
          <div className="relative w-full h-64 sm:h-80 rounded-apple-lg overflow-hidden bg-apple-tile1 apple-product-shadow">
            <img
              key={feedKey}
              src={streamUrl}
              alt="pearOS Live CCTV Stream"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='%23272729'/><text x='50%' y='50%' fill='%23cccccc' font-family='sans-serif' font-size='15' text-anchor='middle'>Awaiting CCTV Feed...</text></svg>";
              }}
            />

            {/* Top Frosted Pill & Circular Refresh Chip (44x44px design.md button-icon-circular) */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between">
              <div className="apple-glass-floating rounded-full px-3 py-1.5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${recorder.recording ? 'bg-apple-rec animate-ping' : 'bg-apple-primary'}`} />
                <span className="type-fine font-mono font-semibold text-apple-ink">
                  {recorder.recording
                    ? `REC ${formatClock(recorder.elapsed_seconds)}`
                    : activeFeed === 'laptop' ? 'CAM 01 LIVE' : 'MOBILE 02 LIVE'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFeedKey(Date.now())}
                aria-label="Refresh Camera Feed"
                className="apple-glass-chip w-[44px] h-[44px] rounded-full flex items-center justify-center"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            {/* Laser Tripwire Overlay */}
            {tripwire && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <div className="w-full h-0.5 bg-apple-rec" />
                <span className="absolute apple-glass-floating px-3 py-1 rounded-full type-micro font-mono font-semibold text-apple-rec uppercase">
                  Tripwire Armed
                </span>
              </div>
            )}

            {/* Bottom Floating Translucent Controls over Photography */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleThermalToggle}
                  className={`px-3.5 py-2 rounded-full type-fine font-semibold flex items-center gap-1.5 transition-transform active:scale-95 ${
                    thermal ? 'bg-apple-primary text-white' : 'apple-glass-chip'
                  }`}
                >
                  <Flame size={13} />
                  <span>Thermal {thermal ? 'On' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTripwireToggle}
                  className={`px-3.5 py-2 rounded-full type-fine font-semibold flex items-center gap-1.5 transition-transform active:scale-95 ${
                    tripwire ? 'bg-apple-primary text-white' : 'apple-glass-chip'
                  }`}
                >
                  <Radar size={13} />
                  <span>Tripwire {tripwire ? 'On' : 'Off'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: 24/7 Always-On 30-Minute CCTV Recording Studio */}
        <section className="apple-glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="type-tagline text-apple-ink">Always-On 30-Min Recorder</h3>
              <span className="apple-glass-floating rounded-full px-2.5 py-0.5 type-micro font-mono font-semibold text-apple-ink flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${recorder.recording ? 'bg-apple-rec animate-ping' : 'bg-apple-ink48'}`} />
                {recorder.recording ? '24/7 ON' : 'OFF'}
              </span>
            </div>
            <p className="type-body text-apple-ink80">
              {recorder.recording
                ? `Always recording ${recorder.source === 'mobile' ? 'Mobile CCTV' : 'Laptop Cam'} · ${recorder.frames_written} frames · auto-loops every 30 min.`
                : 'Always-On 24/7 recording is paused. Tap below to resume continuous 30-min MP4 archiving.'}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleRecordToggle}
                className="apple-btn-primary px-6 py-3 type-caption flex items-center gap-2 min-h-[44px]"
              >
                {recorder.recording && recorder.source === activeFeed ? (
                  <>
                    <Square size={14} className="fill-white" />
                    <span>Pause Always-On & Save</span>
                  </>
                ) : (
                  <>
                    <Disc size={15} />
                    <span>{recorder.recording ? `Switch 24/7 Rec to ${activeFeed === 'mobile' ? 'Mobile' : 'Laptop'}` : 'Enable Always-On Recording'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setContinuousLoop(!continuousLoop)}
                className={`px-4 py-2.5 type-caption flex items-center gap-1.5 min-h-[44px] ${
                  recorder.continuous_loop || continuousLoop
                    ? 'apple-option-chip-selected font-semibold'
                    : 'apple-option-chip'
                }`}
              >
                <Repeat size={14} className="text-apple-primary" />
                <span>24/7 Auto-Loop</span>
              </button>
            </div>
          </div>

          {/* Minimal Precision Circular Timer Ring */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#e0e0e0" strokeWidth="3.5" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="transparent"
                stroke={recorder.recording ? '#ff3b30' : '#0066cc'}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={recorder.recording ? dashOffset : circumference}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-xl font-semibold text-apple-ink">
                {formatClock(recorder.elapsed_seconds)}
              </span>
              <span className="type-micro font-mono text-apple-ink48 uppercase">
                of 30:00
              </span>
            </div>
          </div>
        </section>

        {/* Section 3: Recordings Vault */}
        <section className="apple-glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-apple-divider pb-3">
            <div>
              <h3 className="type-body-strong text-apple-ink">Recordings Vault</h3>
              <p className="type-fine text-apple-ink48 mt-0.5">{recordings.length} saved clips · {totalMb} MB</p>
            </div>
          </div>

          {recordings.length === 0 ? (
            <p className="type-caption text-apple-ink48 py-4 text-center">
              No recordings saved yet. Tap Start 30-Min Recording above to capture your first clip.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-apple-divider">
              {recordings.map((clip) => (
                <div key={clip.filename} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-apple-sm apple-glass-well flex items-center justify-center text-apple-primary shrink-0">
                      {clip.source === 'mobile' ? <Smartphone size={17} /> : <Laptop size={17} />}
                    </div>
                    <div className="min-w-0">
                      <p className="type-caption-strong font-mono text-apple-ink truncate">{clip.filename}</p>
                      <p className="type-fine text-apple-ink48 font-mono">
                        {clip.created_at} · {clip.size_mb} MB {clip.is_active ? '· Recording' : ''}
                      </p>
                    </div>
                  </div>

                  {!clip.is_active && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPlayingClip(clip)}
                        aria-label={`Play ${clip.filename}`}
                        className="apple-btn-primary px-3.5 py-2 type-fine flex items-center gap-1 min-h-[36px]"
                      >
                        <Play size={12} />
                        <span>Play</span>
                      </button>
                      <a
                        href={`${window.location.origin}${clip.download_url}`}
                        download
                        aria-label={`Download ${clip.filename}`}
                        className="apple-btn-pearl w-9 h-9 flex items-center justify-center"
                      >
                        <Download size={14} className="text-apple-primary" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteClip(clip.filename)}
                        aria-label={`Delete ${clip.filename}`}
                        className="apple-btn-pearl w-9 h-9 flex items-center justify-center"
                      >
                        <Trash2 size={14} className="text-apple-ink80" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Liquid Glass Video Player Modal */}
      {playingClip && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-lg apple-glass-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="type-caption-strong font-mono text-apple-ink truncate">{playingClip.filename}</h4>
                <p className="type-fine text-apple-ink48 font-mono">{playingClip.created_at} · {playingClip.size_mb} MB</p>
              </div>
              <button
                type="button"
                onClick={() => setPlayingClip(null)}
                aria-label="Close Video Player"
                className="apple-glass-chip w-[44px] h-[44px] rounded-full flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            <video
              controls
              autoPlay
              playsInline
              className="w-full rounded-apple-lg bg-apple-black apple-product-shadow max-h-80"
              src={`${window.location.origin}${playingClip.stream_url}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
