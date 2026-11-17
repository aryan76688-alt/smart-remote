import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Camera, Terminal, Lock } from 'lucide-react';
import { api } from '../services/api';

export const TouchBar: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchTouchbar = async () => {
      try {
        const data = await api.getTouchbar();
        if (data.success) {
          setItems(data.items);
        }
      } catch (err) {
        // fallback
      }
    };
    fetchTouchbar();
  }, []);

  const handleAction = async (action: string) => {
    await api.executeTouchbar(action);
  };

  return (
    <div className="w-full px-4 pt-1 pb-2">
      <div className="glass-dark rounded-2xl px-3 py-1.5 flex items-center justify-between overflow-x-auto gap-2 shadow-inner border border-white/10">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 pl-1 shrink-0">Touch Bar</span>
        <div className="flex items-center gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAction(item.action)}
              className="px-3 py-1 rounded-xl text-xs font-medium text-white/90 bg-white/10 hover:bg-white/20 active:scale-95 transition-all shrink-0 flex items-center gap-1"
              style={{ borderLeft: `3px solid ${item.color || '#007AFF'}` }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
