import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Sparkles, Play, Pause, Volume2, VolumeX, Terminal, Code2, Globe, Laptop } from 'lucide-react';

interface TouchBarItem {
  id: string;
  label: string;
  action: string;
  color: string;
}

export const TouchBarView: React.FC = () => {
  const [activeApp, setActiveApp] = useState('pearOS System');
  const [items, setItems] = useState<TouchBarItem[]>([
    { id: 'tb_play', label: '⏯ Play/Pause', action: 'media_play', color: '#007AFF' },
    { id: 'tb_mute', label: '🔇 Mute', action: 'media_mute', color: '#FF3B30' },
    { id: 'tb_scr', label: '📸 Screenshot', action: 'key_print', color: '#AF52DE' },
    { id: 'tb_lock', label: '🔒 Lock', action: 'lock_screen', color: '#8E8E93' }
  ]);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);

  useEffect(() => {
    const fetchTouchbar = async () => {
      try {
        const res = await api.getTouchbarItems();
        if (res.success) {
          setActiveApp(res.active_app || 'pearOS System');
          if (res.items && res.items.length > 0) {
            setItems(res.items);
          }
        }
      } catch (e) {
        // Fallback smooth
      }
    };
    fetchTouchbar();
    const interval = setInterval(fetchTouchbar, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: string) => {
    setLastExecuted(action);
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
    try {
      await api.executeTouchbarAction(action);
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setLastExecuted(null), 800);
  };

  return (
    <div className="w-full bg-black/90 backdrop-blur-xl border-t border-b border-white/10 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shadow-inner select-none">
      {/* Esc key & Active App Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => handleAction('key_escape')}
          className="px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 active:bg-neutral-700 text-xs font-mono font-medium"
        >
          esc
        </button>
        <span className="text-[11px] font-medium text-neutral-400 hidden sm:inline-block max-w-[90px] truncate">
          {activeApp}
        </span>
      </div>

      {/* Dynamic Action Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 justify-center">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleAction(item.action)}
            className={`px-3 py-1 rounded-lg text-xs font-medium tracking-tight text-white transition-all shrink-0 active:scale-95 flex items-center gap-1 ${
              lastExecuted === item.action 
                ? 'brightness-150 ring-2 ring-white/50 scale-105' 
                : 'hover:brightness-110'
            }`}
            style={{ 
              backgroundColor: `${item.color}33`, 
              border: `1px solid ${item.color}66` 
            }}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Right Control Strip */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => handleAction('media_mute')}
          className="p-1 rounded-md bg-neutral-800 text-neutral-300 active:bg-neutral-700"
          title="Toggle Mute"
        >
          <Volume2 size={13} />
        </button>
        <button
          onClick={() => handleAction('key_print')}
          className="px-2 py-1 rounded-md bg-neutral-800 text-neutral-300 text-[11px] font-mono"
        >
          ⌘⇧4
        </button>
      </div>
    </div>
  );
};
