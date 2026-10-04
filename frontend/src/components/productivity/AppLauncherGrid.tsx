import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Globe, Terminal, Code, Folder, Calculator, FileText, Compass, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface AppItem {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  running: boolean;
}

export const AppLauncherGrid: React.FC = () => {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const res = await api.getApps();
      setApps(res.apps);
    } catch (e) {
      console.error('Failed to fetch apps:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    const interval = setInterval(fetchApps, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunch = async (id: string) => {
    setBusyAppId(id);
    try {
      await api.launchApp(id);
      setTimeout(fetchApps, 1200);
    } catch (e) {
      console.error('Failed to launch app:', e);
    } finally {
      setBusyAppId(null);
    }
  };

  const handleKill = async (id: string) => {
    setBusyAppId(id);
    try {
      await api.killApp(id);
      setTimeout(fetchApps, 1000);
    } catch (e) {
      console.error('Failed to kill app:', e);
    } finally {
      setBusyAppId(null);
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe': return <Globe className="w-5 h-5 text-blue-400" />;
      case 'Compass': return <Compass className="w-5 h-5 text-orange-400" />;
      case 'Terminal': return <Terminal className="w-5 h-5 text-emerald-400" />;
      case 'Code': return <Code className="w-5 h-5 text-sky-400" />;
      case 'Folder': return <Folder className="w-5 h-5 text-amber-400" />;
      case 'Calculator': return <Calculator className="w-5 h-5 text-purple-400" />;
      case 'FileText': return <FileText className="w-5 h-5 text-pink-400" />;
      default: return <Terminal className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Remote App Launcher</h3>
            <p className="text-xs text-slate-400">Launch & control desktop apps on Kali Linux</p>
          </div>
        </div>
        <button onClick={fetchApps} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-2 bg-slate-900 rounded-lg flex-shrink-0">
                {renderIcon(app.icon)}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{app.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${app.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-[10px] text-slate-400">{app.running ? 'Running' : (app.installed ? 'Installed' : 'Not installed')}</span>
                </div>
              </div>
            </div>

            {app.installed && (
              <div className="flex items-center gap-1 ml-2">
                {app.running ? (
                  <button
                    onClick={() => handleKill(app.id)}
                    disabled={busyAppId === app.id}
                    title="Stop process"
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleLaunch(app.id)}
                    disabled={busyAppId === app.id}
                    title="Launch app"
                    className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
