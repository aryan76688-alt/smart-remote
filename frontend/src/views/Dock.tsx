import React from 'react';
import {
  Compass,
  Sparkles,
  Camera,
  Folder,
  MousePointer,
  Terminal,
  Settings,
  Tv
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type DockTabId = 'maps' | 'agents' | 'cctv' | 'files' | 'remote' | 'terminal' | 'settings';

interface DockProps {
  activeTab: DockTabId;
  onSelectTab: (tab: DockTabId) => void;
}

export const Dock: React.FC<DockProps> = ({ activeTab, onSelectTab }) => {
  const { triggerHaptic } = useApp();

  const dockItems: Array<{
    id: DockTabId;
    label: string;
    icon: any;
    color: string;
    gradient: string;
  }> = [
    {
      id: 'maps',
      label: 'Google Maps',
      icon: Compass,
      color: 'text-white',
      gradient: 'from-emerald-400 to-green-600'
    },
    {
      id: 'agents',
      label: 'AgentOS',
      icon: Sparkles,
      color: 'text-white',
      gradient: 'from-blue-500 via-indigo-500 to-purple-600'
    },
    {
      id: 'cctv',
      label: 'Live CCTV',
      icon: Camera,
      color: 'text-white',
      gradient: 'from-teal-400 to-emerald-600'
    },
    {
      id: 'files',
      label: 'Finder',
      icon: Folder,
      color: 'text-white',
      gradient: 'from-sky-400 to-blue-600'
    },
    {
      id: 'remote',
      label: 'Remote',
      icon: MousePointer,
      color: 'text-white',
      gradient: 'from-indigo-500 to-blue-700'
    },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: Terminal,
      color: 'text-white',
      gradient: 'from-slate-700 to-slate-900'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      color: 'text-white',
      gradient: 'from-slate-500 to-slate-700'
    }
  ];

  return (
    <div className="fixed bottom-3 inset-x-0 z-[1200] flex justify-center pointer-events-none select-none">
      <div className="pointer-events-auto bg-white/75 hover:bg-white/90 backdrop-blur-3xl border border-black/10 shadow-2xl rounded-3xl p-2 flex items-center gap-1.5 sm:gap-2.5 transition-all">
        {dockItems.map((item) => {
          const IconComp = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                triggerHaptic(30);
                onSelectTab(item.id);
              }}
              className="group relative flex flex-col items-center focus:outline-none"
            >
              {/* Tooltip Label */}
              <div className="absolute -top-9 px-2.5 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] font-semibold rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {item.label}
              </div>

              {/* Icon Squircle Button */}
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr ${item.gradient} ${
                  item.color
                } flex items-center justify-center shadow-md transition-all duration-200 group-hover:-translate-y-2 group-hover:scale-110 active:scale-95 ${
                  isActive ? 'ring-2 ring-blue-500/50 shadow-lg -translate-y-0.5' : ''
                }`}
              >
                <IconComp className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-sm" />
              </div>

              {/* Active Indicator Dot */}
              <div className="h-1 mt-1 flex items-center justify-center">
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-800 shadow-xs animate-in zoom-in" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
