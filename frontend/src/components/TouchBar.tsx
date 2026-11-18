import React from 'react';
import { Play, VolumeX, Camera, Terminal, Lock } from 'lucide-react';
import { api } from '../services/api';

const TOUCHBAR_ACTIONS = [
  { id: 'media_play', label: 'Play', icon: Play },
  { id: 'media_mute', label: 'Mute', icon: VolumeX },
  { id: 'key_print', label: 'Snapshot', icon: Camera },
  { id: 'launch_terminal', label: 'Terminal', icon: Terminal },
  { id: 'lock_screen', label: 'Lock', icon: Lock },
];

export const TouchBar: React.FC = () => {
  const handleAction = async (action: string) => {
    try {
      await api.executeTouchbar(action);
    } catch (_e) {}
  };

  return (
    <section className="w-full px-4 py-2 shrink-0">
      <div className="max-w-[980px] mx-auto flex items-center gap-2 overflow-x-auto">
        {TOUCHBAR_ACTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleAction(id)}
            className="apple-btn-pearl flex-1 min-w-[72px] min-h-[40px] px-3 py-2 flex items-center justify-center gap-1.5 type-caption shrink-0"
          >
            <Icon size={14} className="text-apple-primary" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
