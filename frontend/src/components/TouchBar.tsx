import React from 'react';
import { Play, VolumeX, Camera, Terminal, Lock } from 'lucide-react';
import { api } from '../services/api';

const TOUCHBAR_ACTIONS = [
  { id: 'media_play', label: 'Play', icon: Play, colorClass: 'text-stitch-primary' },
  { id: 'media_mute', label: 'Audio', icon: VolumeX, colorClass: 'text-stitch-tertiary' },
  { id: 'key_print', label: 'Snapshot', icon: Camera, colorClass: 'text-stitch-secondary' },
  { id: 'launch_terminal', label: 'Console', icon: Terminal, colorClass: 'text-sky-300' },
  { id: 'lock_screen', label: 'Lock', icon: Lock, colorClass: 'text-stitch-error' },
];

export const TouchBar: React.FC = () => {
  const handleAction = async (action: string) => {
    try {
      await api.executeTouchbar(action);
    } catch (_e) {}
  };

  return (
    <section className="w-full px-3 py-1 flex justify-center relative z-30">
      <div className="w-full max-w-md liquid-glass-subtle rounded-2xl p-1.5 flex items-center justify-between gap-1.5">
        {TOUCHBAR_ACTIONS.map(({ id, label, icon: Icon, colorClass }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleAction(id)}
            className="flex-1 min-h-[44px] py-1.5 px-1 rounded-xl liquid-btn flex flex-col items-center justify-center gap-0.5"
          >
            <Icon size={17} className={colorClass} />
            <span className="text-[10px] font-medium text-stitch-text/90 tracking-tight">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
