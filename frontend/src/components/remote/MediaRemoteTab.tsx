import React, { useState } from 'react';
import {
  Power, Volume2, VolumeX, Volume1, Play, Pause,
  SkipForward, SkipBack, ArrowUp, ArrowDown, ArrowLeft,
  ArrowRight, ExternalLink, Layers, Tv, Unlock
} from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const MediaRemoteTab: React.FC = () => {
  const { addNotification } = useApp();
  const [volume, setVolume] = useState<number>(50);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [switchingApp, setSwitchingApp] = useState<string | null>(null);

  const handleMedia = async (action: string, ottApp?: string, volLevel?: number) => {
    try {
      if (action === 'play_pause') setIsPlaying(!isPlaying);
      await api.sendMedia(action, ottApp, volLevel);
      if (navigator.vibrate) navigator.vibrate(15);
    } catch {
      addNotification('Media Control', `Failed to execute ${action}`, 'error');
    }
  };

  const handleOttSwitch = async (appName: string, displayName: string) => {
    setSwitchingApp(displayName);
    try {
      await api.sendMedia('launch_ott', appName);
      addNotification('Window Switched', `Focused existing ${displayName} window`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch {
      addNotification('OTT Switch Error', `Could not switch to ${displayName}`, 'error');
    } finally {
      setTimeout(() => setSwitchingApp(null), 1000);
    }
  };

  const ottApps = [
    { key: 'youtube', name: 'YouTube', category: 'Video', icon: '▶', badgeColor: 'bg-red-500 text-white', color: 'bg-red-950/30 text-red-300 border-red-900/50 hover:border-red-500' },
    { key: 'youtube_music', name: 'YouTube Music', category: 'Music', icon: '♫', badgeColor: 'bg-red-600 text-white', color: 'bg-red-950/40 text-red-200 border-red-900/60 hover:border-red-500' },
    { key: 'netflix', name: 'Netflix', category: 'Movies', icon: 'N', badgeColor: 'bg-rose-600 text-white', color: 'bg-rose-950/30 text-rose-300 border-rose-900/50 hover:border-rose-500' },
    { key: 'prime', name: 'Prime Video', category: 'Movies', icon: 'P', badgeColor: 'bg-blue-600 text-white', color: 'bg-blue-950/30 text-blue-300 border-blue-900/50 hover:border-blue-500' },
    { key: 'spotify', name: 'Spotify', category: 'Music', icon: '♫', badgeColor: 'bg-emerald-500 text-slate-950', color: 'bg-emerald-950/30 text-emerald-300 border-emerald-900/50 hover:border-emerald-500' },
    { key: 'disney', name: 'Disney+', category: 'Movies', icon: '+', badgeColor: 'bg-indigo-600 text-white', color: 'bg-indigo-950/30 text-indigo-300 border-indigo-900/50 hover:border-indigo-500' },
    { key: 'hotstar', name: 'Hotstar', category: 'Live & OTT', icon: '★', badgeColor: 'bg-sky-600 text-white', color: 'bg-sky-950/30 text-sky-300 border-sky-900/50 hover:border-sky-500' },
    { key: 'twitch', name: 'Twitch', category: 'Live', icon: '◆', badgeColor: 'bg-purple-600 text-white', color: 'bg-purple-950/30 text-purple-300 border-purple-900/50 hover:border-purple-500' },
    { key: 'apple_tv', name: 'Apple TV', category: 'Originals', icon: '', badgeColor: 'bg-slate-700 text-white', color: 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-600' },
    { key: 'hulu', name: 'Hulu', category: 'Series', icon: 'H', badgeColor: 'bg-green-600 text-white', color: 'bg-green-950/30 text-green-300 border-green-900/50 hover:border-green-500' },
    { key: 'crunchyroll', name: 'Crunchyroll', category: 'Anime', icon: 'C', badgeColor: 'bg-amber-600 text-white', color: 'bg-amber-950/30 text-amber-300 border-amber-900/50 hover:border-amber-500' },
    { key: 'max', name: 'Max (HBO)', category: 'Movies', icon: 'M', badgeColor: 'bg-violet-600 text-white', color: 'bg-violet-950/30 text-violet-300 border-violet-900/50 hover:border-violet-500' },
    { key: 'jiocinema', name: 'JioCinema', category: 'Entertainment', icon: 'J', badgeColor: 'bg-pink-600 text-white', color: 'bg-pink-950/30 text-pink-300 border-pink-900/50 hover:border-pink-500' },
    { key: 'plex', name: 'Plex', category: 'Media', icon: 'P', badgeColor: 'bg-yellow-600 text-slate-950', color: 'bg-yellow-950/30 text-yellow-300 border-yellow-900/50 hover:border-yellow-500' },
    { key: 'soundcloud', name: 'SoundCloud', category: 'Audio', icon: '☁', badgeColor: 'bg-orange-600 text-white', color: 'bg-orange-950/30 text-orange-300 border-orange-900/50 hover:border-orange-500' },
    { key: 'peacock', name: 'Peacock', category: 'Shows', icon: 'P', badgeColor: 'bg-teal-600 text-white', color: 'bg-teal-950/30 text-teal-300 border-teal-900/50 hover:border-teal-500' },
    { key: 'paramount', name: 'Paramount+', category: 'Films', icon: '▲', badgeColor: 'bg-blue-700 text-white', color: 'bg-blue-950/40 text-blue-300 border-blue-900/60 hover:border-blue-500' },
    { key: 'sonyliv', name: 'Sony LIV', category: 'Sports & TV', icon: 'S', badgeColor: 'bg-indigo-500 text-white', color: 'bg-indigo-950/30 text-indigo-300 border-indigo-900/50 hover:border-indigo-500' },
    { key: 'zee5', name: 'ZEE5', category: 'Regional', icon: 'Z', badgeColor: 'bg-purple-700 text-white', color: 'bg-purple-950/30 text-purple-300 border-purple-900/50 hover:border-purple-500' },
    { key: 'espn', name: 'ESPN+', category: 'Live Sports', icon: 'E', badgeColor: 'bg-red-700 text-white', color: 'bg-red-950/30 text-red-300 border-red-900/50 hover:border-red-500' },
    { key: 'vlc', name: 'VLC Player', category: 'Desktop', icon: '▲', badgeColor: 'bg-amber-500 text-slate-950', color: 'bg-amber-950/30 text-amber-300 border-amber-900/50 hover:border-amber-500' },
  ];

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredApps = ottApps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedCategory === 'all') return matchesSearch;
    return matchesSearch && app.category.toLowerCase().includes(selectedCategory);
  });

  return (
    <div className="flex flex-col h-full space-y-4 max-w-md mx-auto w-full select-none overflow-y-auto pb-6">
      {/* Power & Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
          <Tv className="w-4 h-4" />
          <span>MEDIA &amp; OTT WORKSTATION REMOTE</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              try {
                const res = await api.unlockScreen();
                addNotification('Screen Awakened', 'Workstation screen awakened and unlocked.', 'success');
              } catch {
                addNotification('Unlock Failed', 'Could not reach display unlock service.', 'warning');
              }
            }}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
            title="Unlock & Wake Workstation Screen"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>UNLOCK</span>
          </button>
          <button
            onClick={() => handleMedia('power')}
            className="w-10 h-10 rounded-full bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-400 flex items-center justify-center active:scale-95 transition-transform"
            title="Display Power / Lock"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Volume Controls Row */}
      <div className="bg-cyber-surface border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleMedia('vol_down')}
            className="w-14 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center"
          >
            VOL -
          </button>
          <button
            onClick={() => handleMedia('mute')}
            className="w-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 active:scale-95 transition-transform flex items-center justify-center"
            title="Mute / Unmute"
          >
            <VolumeX className="w-5 h-5 text-amber-400" />
          </button>
          <button
            onClick={() => handleMedia('vol_up')}
            className="w-14 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center"
          >
            VOL +
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center space-x-3 pt-1">
          <Volume1 className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => {
              const val = parseInt(e.target.value);
              setVolume(val);
              handleMedia('set_volume', undefined, val);
            }}
            className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400 w-8 text-right">{volume}%</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleMedia('prev')}
          className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 active:scale-95"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={() => handleMedia('play_pause')}
          className="py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center justify-center active:scale-95 shadow-md shadow-cyan-600/20"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
        <button
          onClick={() => handleMedia('next')}
          className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 active:scale-95"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation D-Pad */}
      <div className="flex items-center justify-center py-2">
        <div className="w-52 h-52 rounded-full bg-slate-900 border-2 border-slate-800 relative flex items-center justify-center shadow-xl">
          <button
            onClick={() => api.sendKey('Up')}
            className="absolute top-2 w-14 h-14 rounded-t-full flex items-center justify-center text-slate-300 hover:text-white active:bg-cyan-500 active:text-slate-950"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => api.sendKey('Down')}
            className="absolute bottom-2 w-14 h-14 rounded-b-full flex items-center justify-center text-slate-300 hover:text-white active:bg-cyan-500 active:text-slate-950"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            onClick={() => api.sendKey('Left')}
            className="absolute left-2 w-14 h-14 rounded-l-full flex items-center justify-center text-slate-300 hover:text-white active:bg-cyan-500 active:text-slate-950"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => api.sendKey('Right')}
            className="absolute right-2 w-14 h-14 rounded-r-full flex items-center justify-center text-slate-300 hover:text-white active:bg-cyan-500 active:text-slate-950"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => api.sendKey('Return')}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-md active:scale-95 flex items-center justify-center"
          >
            OK
          </button>
        </div>
      </div>

      {/* OTT Shortcut Buttons with Small Icon & Name */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase tracking-wider">
            Streaming &amp; OTT Switcher ({ottApps.length})
          </span>
          <span className="text-[10px] text-cyan-400 font-mono flex items-center space-x-1">
            <Layers className="w-3 h-3" />
            <span>Auto-focuses open tab</span>
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 text-[11px]">
          {['all', 'movies', 'music', 'live'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'all' ? `All (${ottApps.length})` : cat}
            </button>
          ))}
        </div>

        {/* Search input for instant filter */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter OTT by name or category..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
        />

        {/* 2-Column Responsive Grid with Icon + Name + Category */}
        <div className="grid grid-cols-2 gap-2">
          {filteredApps.map(app => (
            <button
              key={app.key}
              onClick={() => handleOttSwitch(app.key, app.name)}
              className={`p-2.5 rounded-2xl border flex items-center space-x-2.5 transition-all active:scale-95 group text-left ${app.color}`}
            >
              {/* Small Brand Icon */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs shadow-sm ${app.badgeColor}`}>
                {app.icon}
              </div>

              {/* Name & Category */}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs truncate leading-tight text-slate-100 group-hover:text-white">
                  {app.name}
                </div>
                <div className="text-[10px] opacity-75 truncate font-mono leading-tight">
                  {app.category}
                </div>
              </div>

              {/* Focus indicator / external link */}
              {switchingApp === app.name ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              ) : (
                <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
