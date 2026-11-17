import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, Music, Sliders, Moon, FastForward, Rewind, Play, Pause, 
  Volume2, Sparkles, CloudRain, Wind, Waves, Radio
} from 'lucide-react';

interface AudioMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioMasterModal: React.FC<AudioMasterModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'eq' | 'lyrics' | 'whitenoise' | 'scrub'>('lyrics');
  
  // EQ State
  const [eqBands, setEqBands] = useState<Record<string, number>>({
    '32Hz': 0, '64Hz': 2, '125Hz': 1, '250Hz': 0,
    '500Hz': 0, '1kHz': 1, '2kHz': 2, '4kHz': 3, '8kHz': 2, '16kHz': 1
  });

  // Lyrics & Visualizer
  const [lyricsData, setLyricsData] = useState<{
    title: string;
    artist: string;
    lyrics: Array<{ sec: number; text: string }>;
    visualizer_bars: number[];
  }>({
    title: 'Sequoia Harmony',
    artist: 'pearOS Studio',
    lyrics: [],
    visualizer_bars: [30, 45, 60, 80, 50, 40, 70, 90, 65, 45, 30, 55, 75, 85, 60, 40]
  });

  // White noise
  const [whiteNoiseActive, setWhiteNoiseActive] = useState(false);
  const [whiteNoiseSound, setWhiteNoiseSound] = useState('rain');
  const [sleepTimer, setSleepTimer] = useState(30);

  useEffect(() => {
    if (isOpen) {
      api.getAudioEqualizer().then(res => {
        if (res.success && res.bands) setEqBands(res.bands);
      }).catch(() => null);

      api.getMediaLyrics().then(res => {
        if (res.success) setLyricsData(res as any);
      }).catch(() => null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEqChange = async (band: string, val: number) => {
    const updated = { ...eqBands, [band]: val };
    setEqBands(updated);
    try {
      await api.setAudioEqualizer(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleWhiteNoise = async (soundName?: string) => {
    const targetSound = soundName || whiteNoiseSound;
    const nextActive = soundName ? true : !whiteNoiseActive;
    setWhiteNoiseActive(nextActive);
    if (soundName) setWhiteNoiseSound(soundName);
    try {
      await api.toggleWhiteNoise(nextActive, targetSound, sleepTimer);
    } catch (e) {
      console.error(e);
    }
  };

  const handleScrub = async (act: string) => {
    if ('vibrate' in navigator) navigator.vibrate(15);
    try {
      await api.scrubMedia(act);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Music size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Audio Master Suite</h3>
              <p className="text-[11px] text-neutral-500">PipeWire DSP • 10-Band EQ & Lyrics</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-2 bg-neutral-100/60 border-b border-neutral-100 gap-1 text-xs">
          <button
            onClick={() => setTab('lyrics')}
            className={`flex-1 py-1.5 rounded-xl font-medium transition-all ${tab === 'lyrics' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            Lyrics & Visuals
          </button>
          <button
            onClick={() => setTab('eq')}
            className={`flex-1 py-1.5 rounded-xl font-medium transition-all ${tab === 'eq' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            10-Band EQ
          </button>
          <button
            onClick={() => setTab('whitenoise')}
            className={`flex-1 py-1.5 rounded-xl font-medium transition-all ${tab === 'whitenoise' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            Sleep Noise
          </button>
          <button
            onClick={() => setTab('scrub')}
            className={`flex-1 py-1.5 rounded-xl font-medium transition-all ${tab === 'scrub' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            Scrubber
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
          {tab === 'lyrics' && (
            <div className="space-y-4 text-center">
              <div className="py-2">
                <div className="text-base font-bold text-neutral-900">{lyricsData.title}</div>
                <div className="text-xs text-neutral-500">{lyricsData.artist}</div>
              </div>

              {/* Spectrum Visualizer */}
              <div className="flex items-end justify-center gap-1 h-24 bg-neutral-950 rounded-2xl p-3 border border-neutral-800">
                {(lyricsData.visualizer_bars || []).map((bar, i) => (
                  <div 
                    key={i} 
                    className="w-2 rounded-t bg-gradient-to-t from-purple-500 to-blue-400 transition-all duration-150"
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div>

              {/* Karaoke Lyrics Scroller */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 text-left space-y-2 text-xs">
                {(lyricsData.lyrics || []).map((lyric, idx) => (
                  <div key={idx} className={`p-1.5 rounded-lg ${idx === 1 ? 'font-bold text-purple-700 bg-purple-50' : 'text-neutral-500'}`}>
                    {lyric.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'eq' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>Flat Curve</span>
                <span className="font-semibold text-neutral-900">Preset: Vocal Clarity</span>
                <span>+12 dB</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center py-2">
                {Object.entries(eqBands).map(([freq, val]) => (
                  <div key={freq} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-neutral-500">{val > 0 ? `+${val}` : val}</span>
                    <input 
                      type="range"
                      min="-10"
                      max="10"
                      step="1"
                      value={val}
                      onChange={(e) => handleEqChange(freq, parseInt(e.target.value))}
                      className="h-28 w-2 accent-purple-600 appearance-none bg-neutral-200 rounded-full [writing-mode:vertical-lr] [direction:rtl]"
                    />
                    <span className="text-[9px] font-semibold text-neutral-600 mt-1">{freq}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'whitenoise' && (
            <div className="space-y-4 text-center">
              <div className="text-xs text-neutral-500">
                Synthesized in RAM via ffmpeg directly through laptop speakers.
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'rain', label: 'Heavy Rain', icon: CloudRain },
                  { id: 'brown', label: 'Brown Noise', icon: Wind },
                  { id: 'waves', label: 'Ocean Waves', icon: Waves },
                  { id: 'fan', label: 'Night Fan', icon: Radio },
                ].map((sound) => {
                  const Icon = sound.icon;
                  const isSelected = whiteNoiseActive && whiteNoiseSound === sound.id;
                  return (
                    <button
                      key={sound.id}
                      onClick={() => handleToggleWhiteNoise(sound.id)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all ${
                        isSelected 
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                          : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-800'
                      }`}
                    >
                      <Icon size={20} className={isSelected ? 'text-white' : 'text-purple-500'} />
                      <div className="font-semibold text-xs">{sound.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between bg-neutral-50 p-3 rounded-2xl border border-neutral-100 text-xs">
                <span className="text-neutral-600 flex items-center gap-1.5">
                  <Moon size={14} className="text-purple-600" /> Sleep Timer: {sleepTimer} min
                </span>
                <button
                  onClick={() => setSleepTimer(sleepTimer === 30 ? 60 : sleepTimer === 60 ? 15 : 30)}
                  className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-neutral-700 font-medium"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {tab === 'scrub' && (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => handleScrub('skip_back_15')}
                  className="w-14 h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 flex flex-col items-center justify-center text-neutral-800 transition-all"
                >
                  <Rewind size={20} />
                  <span className="text-[10px] font-bold mt-0.5">-15s</span>
                </button>
                <button
                  onClick={() => handleScrub('skip_forward_15')}
                  className="w-14 h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white active:scale-95 flex flex-col items-center justify-center transition-all shadow-md"
                >
                  <FastForward size={20} />
                  <span className="text-[10px] font-bold mt-0.5">+15s</span>
                </button>
              </div>

              <div className="flex justify-center gap-2 pt-2">
                {['1.0x', '1.25x', '1.5x', '2.0x'].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => handleScrub(`speed_${spd.replace('.', '_')}`)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 active:scale-95"
                  >
                    {spd} Speed
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
