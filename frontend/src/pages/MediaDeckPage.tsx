import React, { useState, useEffect, useRef } from 'react';
import {
  Tv, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Mic,
  Bell, AlertTriangle, Info, Camera, MessageSquare, Radio, Presentation,
  Maximize, Minimize, RefreshCw, Volume1
} from 'lucide-react';
import { api } from '../services/api';

export const MediaDeckPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'player' | 'clicker' | 'tts' | 'audio_stream'>('player');
  const [loading, setLoading] = useState(false);

  // Media Player State
  const [mediaInfo, setMediaInfo] = useState<any>({
    status: 'Stopped',
    title: 'No media detected',
    artist: '',
    album: '',
    player: '',
    volume: 50,
    muted: false
  });

  // Presentation Clicker State
  const [slideSeconds, setSlideSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [ttsRate, setTtsRate] = useState(0);
  const [ttsPitch, setTtsPitch] = useState(0);

  // Audio Streaming to Phone State
  const [isStreamingAudio, setIsStreamingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Load Media Status ──
  const fetchMedia = async () => {
    try {
      const res = await api.getMediaStatus();
      setMediaInfo(res);
    } catch {
      // ignore
    }
  };

  const handleMediaAction = async (action: string) => {
    try {
      await api.sendMediaAction(action);
      setTimeout(fetchMedia, 300);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  // ── Presentation Timer ──
  useEffect(() => {
    let interval: any;
    if (timerRunning) {
      interval = setInterval(() => setSlideSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── TTS ──
  const handleSpeak = async () => {
    if (!ttsText.trim()) return;
    try {
      setLoading(true);
      await api.speakTts(ttsText, ttsRate, ttsPitch);
      setTtsText('');
    } catch (err: any) {
      alert(err.message || 'TTS failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Soundboard ──
  const handlePlaySound = async (sound: string) => {
    try {
      await api.playSoundboard(sound);
    } catch (err: any) {
      alert(err.message || 'Sound failed');
    }
  };

  // ── Laptop Audio Stream ──
  const toggleAudioStream = () => {
    if (!audioRef.current) return;
    if (isStreamingAudio) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsStreamingAudio(false);
    } else {
      audioRef.current.src = `/api/media/audio/stream?t=${Date.now()}`;
      audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
      setIsStreamingAudio(true);
    }
  };

  useEffect(() => {
    fetchMedia();
    const intv = setInterval(fetchMedia, 4000);
    return () => clearInterval(intv);
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-purple-500/30 p-4 rounded-2xl shadow-lg backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              MULTIMEDIA & AUDIO DECK
              <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono">
                MPRIS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Universal Player • Clicker • TTS • Audio Stream</p>
          </div>
        </div>

        <button
          onClick={fetchMedia}
          className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
        {[
          { id: 'player', label: 'PLAYER', icon: Tv },
          { id: 'clicker', label: 'CLICKER', icon: Presentation },
          { id: 'tts', label: 'SOUND/TTS', icon: Mic },
          { id: 'audio_stream', label: 'STREAM', icon: Radio }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold tracking-wider transition-all ${
                isActive
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: UNIVERSAL MEDIA CONTROLLER ── */}
      {activeTab === 'player' && (
        <div className="space-y-4">
          {/* Now Playing Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400">
                {mediaInfo.player || 'System Audio'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                mediaInfo.status === 'Playing' ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-400'
              }`}>
                {mediaInfo.status}
              </span>
            </div>

            <div className="text-center py-4 space-y-1">
              <div className="text-base font-bold text-slate-100 truncate px-4">
                {mediaInfo.title || 'No active track'}
              </div>
              <div className="text-xs text-slate-400 font-medium truncate">
                {mediaInfo.artist || 'Unknown Artist'} {mediaInfo.album ? `• ${mediaInfo.album}` : ''}
              </div>
            </div>

            {/* Media Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => handleMediaAction('prev')}
                className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all shadow-md"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={() => handleMediaAction('play_pause')}
                className="p-5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
                title="Play / Pause"
              >
                {mediaInfo.status === 'Playing' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>

              <button
                onClick={() => handleMediaAction('next')}
                className="p-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all shadow-md"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume Slider */}
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleMediaAction(mediaInfo.muted ? 'unmute' : 'mute')}>
                    {mediaInfo.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-purple-400" />}
                  </button>
                  <span>Volume</span>
                </div>
                <span>{mediaInfo.volume}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={mediaInfo.volume}
                onChange={e => handleMediaAction(`vol:${e.target.value}`)}
                className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PRESENTATION CLICKER ── */}
      {activeTab === 'clicker' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            {/* Timer */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
              <div>
                <div className="text-[10px] text-slate-500">ELAPSED TIME</div>
                <div className="text-xl font-bold text-cyan-400">{formatTimer(slideSeconds)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700"
                >
                  {timerRunning ? 'PAUSE' : 'START'}
                </button>
                <button
                  onClick={() => { setSlideSeconds(0); setTimerRunning(false); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  RESET
                </button>
              </div>
            </div>

            {/* Clicker Buttons */}
            <div className="grid grid-cols-2 gap-3 h-48">
              <button
                onClick={() => handleMediaAction('prev')}
                className="rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-200 font-bold active:scale-98 transition-all shadow-lg"
              >
                <SkipBack className="w-8 h-8 text-cyan-400" />
                <span className="text-sm tracking-wider">PREVIOUS SLIDE</span>
              </button>

              <button
                onClick={() => handleMediaAction('next')}
                className="rounded-2xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 flex flex-col items-center justify-center gap-2 text-cyan-200 font-bold active:scale-98 transition-all shadow-lg"
              >
                <SkipForward className="w-8 h-8 text-cyan-300" />
                <span className="text-sm tracking-wider">NEXT SLIDE</span>
              </button>
            </div>

            {/* Presentation Controls */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => api.sendMediaAction('action:F5')}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono hover:bg-slate-900"
              >
                F5 (Start Slideshow)
              </button>
              <button
                onClick={() => api.sendMediaAction('action:Escape')}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono hover:bg-slate-900"
              >
                ESC (Exit Slideshow)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TEXT-TO-SPEECH & SOUNDBOARD ── */}
      {activeTab === 'tts' && (
        <div className="space-y-4">
          {/* TTS Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Mic className="w-4 h-4 text-purple-400" />
              Speak Text on Laptop Speakers
            </span>

            <textarea
              rows={3}
              value={ttsText}
              onChange={e => setTtsText(e.target.value)}
              placeholder="Type message to speak aloud on laptop..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
            />

            <button
              onClick={handleSpeak}
              disabled={loading || !ttsText.trim()}
              className="w-full py-2.5 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/50 text-purple-200 font-bold text-xs tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Volume1 className="w-4 h-4" /> BROADCAST VOICE
            </button>
          </div>

          {/* Soundboard Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-200">System Soundboard</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bell', label: 'Ding Bell', icon: Bell },
                { id: 'alert', label: 'Warning', icon: AlertTriangle },
                { id: 'info', label: 'Info Chime', icon: Info },
                { id: 'camera', label: 'Shutter', icon: Camera },
                { id: 'ping', label: 'Instant Ping', icon: MessageSquare },
                { id: 'siren', label: 'Siren Alarm', icon: Radio },
                { id: 'airhorn', label: 'Airhorn', icon: Volume2 }
              ].map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => handlePlaySound(s.id)}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 flex flex-col items-center justify-center gap-1.5 text-xs font-medium active:scale-95 transition-all"
                  >
                    <Icon className="w-4 h-4 text-purple-400" />
                    <span className="text-[11px] truncate w-full text-center">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: LAPTOP AUDIO STREAM TO PHONE ── */}
      {activeTab === 'audio_stream' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 text-center">
            <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 w-16 h-16 mx-auto flex items-center justify-center">
              <Radio className={`w-8 h-8 ${isStreamingAudio ? 'animate-pulse text-emerald-400' : ''}`} />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-100">Live Laptop Audio Stream</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Listen to your Kali laptop sound directly in your phone headphones over low-latency chunked audio.
              </p>
            </div>

            <button
              onClick={toggleAudioStream}
              className={`w-full max-w-xs py-3.5 rounded-xl font-bold text-xs tracking-wider mx-auto flex items-center justify-center gap-2 active:scale-98 transition-all ${
                isStreamingAudio
                  ? 'bg-rose-600/30 text-rose-300 border border-rose-500'
                  : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500'
              }`}
            >
              {isStreamingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isStreamingAudio ? 'STOP AUDIO STREAM' : 'LISTEN TO LAPTOP AUDIO'}
            </button>

            <audio ref={audioRef} className="hidden" preload="none" />
          </div>
        </div>
      )}
    </div>
  );
};
