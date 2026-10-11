import React, { useState, useEffect } from 'react';
import {
  Mic, MicOff, Camera, Terminal, Code, Globe, ShieldAlert,
  Lock, Camera as CameraIcon, Volume2, Play, RefreshCw, Sparkles,
  Plus, Trash2, Check, Zap, Flame, VolumeX
} from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface MacroItem {
  id: string;
  name: string;
  desc: string;
  iconName: string;
  color: string;
  actionType: 'api' | 'command';
  payload: string;
}

const DEFAULT_MACROS: MacroItem[] = [
  { id: 'm1', name: 'Mute Mic', desc: 'Toggle Master Mute', iconName: 'mic', color: 'rose', actionType: 'api', payload: 'mute_audio' },
  { id: 'm2', name: 'Panic Switch', desc: 'Lock + Blank Screen', iconName: 'shield', color: 'rose', actionType: 'api', payload: 'panic' },
  { id: 'm3', name: 'Open Terminal', desc: 'Spawn Kali Terminal', iconName: 'terminal', color: 'cyan', actionType: 'api', payload: 'launch:terminal' },
  { id: 'm4', name: 'Open VS Code', desc: 'Spawn Code Editor', iconName: 'code', color: 'blue', actionType: 'api', payload: 'launch:code' },
  { id: 'm5', name: 'Open Browser', desc: 'Spawn Chromium', iconName: 'globe', color: 'amber', actionType: 'api', payload: 'launch:chromium' },
  { id: 'm6', name: 'Lock Session', desc: 'Lock Kali Desktop', iconName: 'lock', color: 'purple', actionType: 'api', payload: 'lock_session' },
  { id: 'm7', name: 'Screenshot', desc: 'Capture Desktop', iconName: 'camera', color: 'emerald', actionType: 'api', payload: 'screenshot' },
  { id: 'm8', name: 'Volume 100%', desc: 'Boost Master Volume', iconName: 'volume', color: 'emerald', actionType: 'api', payload: 'vol:100' },
  { id: 'm9', name: 'Play / Pause', desc: 'Media Toggle', iconName: 'play', color: 'purple', actionType: 'api', payload: 'play_pause' },
  { id: 'm10', name: 'Clean Cache', desc: 'Free RAM Buffers', iconName: 'refresh', color: 'cyan', actionType: 'api', payload: 'clear_cache' },
  { id: 'm11', name: 'Stealth Mode', desc: 'Blank Host Monitor', iconName: 'flame', color: 'amber', actionType: 'api', payload: 'stealth' },
  { id: 'm12', name: 'AI Vision Scan', desc: 'Analyze Screen with AI', iconName: 'sparkles', color: 'cyan', actionType: 'api', payload: 'screen_vision' }
];

export const StreamDeck: React.FC<{ onOpenVision?: () => void }> = ({ onOpenVision }) => {
  const { triggerHaptic } = useApp();
  const [macros, setMacros] = useState<MacroItem[]>(() => {
    try {
      const saved = localStorage.getItem('smart_remote_custom_macros');
      return saved ? JSON.parse(saved) : DEFAULT_MACROS;
    } catch {
      return DEFAULT_MACROS;
    }
  });

  const [activeRunningId, setActiveRunningId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newMacroName, setNewMacroName] = useState('');
  const [newMacroCmd, setNewMacroCmd] = useState('');
  const [newMacroColor, setNewMacroColor] = useState('cyan');

  const saveMacros = (items: MacroItem[]) => {
    setMacros(items);
    localStorage.setItem('smart_remote_custom_macros', JSON.stringify(items));
  };

  const handleTrigger = async (macro: MacroItem) => {
    triggerHaptic(50);
    setActiveRunningId(macro.id);

    try {
      if (macro.payload === 'screen_vision') {
        if (onOpenVision) onOpenVision();
        else alert('Screen Vision triggered!');
      } else if (macro.payload === 'panic') {
        await api.triggerPanic();
      } else if (macro.payload === 'stealth') {
        await api.toggleStealth(true);
      } else if (macro.payload.startsWith('launch:')) {
        const appId = macro.payload.split(':')[1];
        await fetch('/api/productivity/apps/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId })
        });
      } else if (macro.payload.startsWith('vol:')) {
        await api.sendMediaAction(macro.payload);
      } else if (macro.payload === 'play_pause') {
        await api.sendMediaAction('play_pause');
      } else if (macro.actionType === 'command') {
        await api.executeCommand(macro.payload, true);
      } else {
        await fetch('/api/system/quick-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: macro.payload })
        });
      }
    } catch (err: any) {
      alert(`Macro execution error: ${err.message}`);
    } finally {
      setTimeout(() => setActiveRunningId(null), 600);
    }
  };

  const handleAddMacro = () => {
    if (!newMacroName.trim() || !newMacroCmd.trim()) return;
    const newItem: MacroItem = {
      id: 'custom_' + Date.now(),
      name: newMacroName.trim(),
      desc: 'Custom Bash Macro',
      iconName: 'zap',
      color: newMacroColor,
      actionType: 'command',
      payload: newMacroCmd.trim()
    };
    saveMacros([...macros, newItem]);
    setNewMacroName('');
    setNewMacroCmd('');
    setShowAddModal(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this macro?')) {
      saveMacros(macros.filter(m => m.id !== id));
    }
  };

  const renderIcon = (name: string, color: string) => {
    switch (name) {
      case 'mic': return <Mic className={`w-5 h-5 text-${color}-400`} />;
      case 'shield': return <ShieldAlert className={`w-5 h-5 text-${color}-400`} />;
      case 'terminal': return <Terminal className={`w-5 h-5 text-${color}-400`} />;
      case 'code': return <Code className={`w-5 h-5 text-${color}-400`} />;
      case 'globe': return <Globe className={`w-5 h-5 text-${color}-400`} />;
      case 'lock': return <Lock className={`w-5 h-5 text-${color}-400`} />;
      case 'camera': return <CameraIcon className={`w-5 h-5 text-${color}-400`} />;
      case 'volume': return <Volume2 className={`w-5 h-5 text-${color}-400`} />;
      case 'play': return <Play className={`w-5 h-5 text-${color}-400`} />;
      case 'refresh': return <RefreshCw className={`w-5 h-5 text-${color}-400`} />;
      case 'sparkles': return <Sparkles className={`w-5 h-5 text-${color}-400`} />;
      case 'flame': return <Flame className={`w-5 h-5 text-${color}-400`} />;
      default: return <Zap className={`w-5 h-5 text-${color}-400`} />;
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold font-mono tracking-wider text-slate-300 uppercase">
            STREAM DECK & MACRO MATRIX
          </h2>
          <p className="text-[10px] text-slate-500 font-mono">1-Tap Hardware & Automation Actions</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold font-mono active:scale-95 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>ADD MACRO</span>
        </button>
      </div>

      {/* 3x4 / 4x4 Responsive Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {macros.map((macro) => {
          const isRunning = activeRunningId === macro.id;

          return (
            <button
              key={macro.id}
              onClick={() => handleTrigger(macro)}
              className={`relative h-24 p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 shadow-lg group overflow-hidden ${
                isRunning
                  ? 'bg-cyan-500/30 border-cyan-400 scale-95 shadow-cyan-500/40'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
              }`}
            >
              {/* Top Row: Icon + Delete button for custom */}
              <div className="flex items-center justify-between w-full">
                <div className={`p-2 rounded-xl bg-slate-950 border border-slate-800`}>
                  {renderIcon(macro.iconName, macro.color)}
                </div>

                {macro.id.startsWith('custom_') && (
                  <span
                    onClick={(e) => handleDelete(macro.id, e)}
                    className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <div>
                <div className="text-xs font-bold text-slate-100 truncate">{macro.name}</div>
                <div className="text-[9px] text-slate-400 font-mono truncate">{macro.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add Macro Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 font-mono">Create Custom Stream Deck Button</h3>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400">Button Label</label>
              <input
                type="text"
                placeholder="e.g. Restart Docker, Git Pull"
                value={newMacroName}
                onChange={e => setNewMacroName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400">Linux Bash Command</label>
              <input
                type="text"
                placeholder="e.g. docker compose restart"
                value={newMacroCmd}
                onChange={e => setNewMacroCmd(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMacro}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Save Button
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
