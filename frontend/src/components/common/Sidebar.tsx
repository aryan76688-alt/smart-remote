import React, { useState } from 'react';
import {
  LayoutDashboard, Terminal, Monitor, Video, Gamepad2, Folder,
  Cpu, Bot, Tv, Server, History, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { activeRoute, setActiveRoute, systemInfo } = useApp();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, route: '/dashboard' },
    { label: 'CCTV Surveillance', icon: Video, route: '/cctv' },
    { label: 'Screen Mirror', icon: Monitor, route: '/mirror' },
    { label: 'Terminal', icon: Terminal, route: '/terminal' },
    { label: 'Remote', icon: Gamepad2, route: '/remote' },
    { label: 'Files', icon: Folder, route: '/files' },
    { label: 'System', icon: Cpu, route: '/system' },
    { label: 'AI Assistant', icon: Bot, route: '/assistant' },
    { label: 'Media Remote', icon: Tv, route: '/media' },
    { label: 'Devices', icon: Server, route: '/devices' },
    { label: 'Activity', icon: History, route: '/history' },
    { label: 'Settings', icon: Settings, route: '/settings' },
  ];

  return (
    <aside
      className={`border-r border-cyber-border bg-cyber-surface/70 backdrop-blur-md flex flex-col justify-between transition-all duration-200 z-20 select-none ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Navigation Items */}
      <div className="py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => setActiveRoute(item.route)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 border border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Bottom Collapser & Host Info */}
      <div className="p-3 border-t border-cyber-border space-y-2">
        {!collapsed && systemInfo && (
          <div className="px-2 py-1.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-400">
            <div className="text-slate-200 truncate font-semibold">{systemInfo.hostname}</div>
            <div className="text-[10px] text-cyan-400 truncate">{systemInfo.os_name}</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
