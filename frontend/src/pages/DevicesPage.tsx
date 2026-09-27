import React, { useEffect, useState } from 'react';
import { Server, Wifi, Star, Edit3, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { DeviceItem } from '../types';
import { useWebSocket } from '../context/WebSocketContext';
import { useApp } from '../context/AppContext';

export const DevicesPage: React.FC = () => {
  const { addNotification } = useApp();
  const { latencyMs } = useWebSocket();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingDevice, setEditingDevice] = useState<DeviceItem | null>(null);
  const [editName, setEditName] = useState<string>('');

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleUpdate = async () => {
    if (!editingDevice || !editName.trim()) return;
    try {
      await api.updateDevice(editingDevice.id, { name: editName.trim() });
      addNotification('Device Renamed', `Updated name to ${editName}`, 'success');
      setEditingDevice(null);
      fetchDevices();
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  const toggleFavorite = async (dev: DeviceItem) => {
    try {
      await api.updateDevice(dev.id, { is_favorite: !dev.is_favorite });
      fetchDevices();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 max-w-4xl mx-auto w-full select-none overflow-y-auto pb-24">
      <div className="flex items-center justify-between border-b border-cyber-border pb-3">
        <div>
          <h1 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>TRUSTED PERSONAL DEVICES</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Private Tailscale device cluster
          </p>
        </div>
        <button
          onClick={fetchDevices}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {devices.map(dev => (
          <div
            key={dev.id}
            className="p-4 bg-cyber-surface border border-slate-800 rounded-2xl space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-sm text-slate-100">{dev.name}</h3>
              </div>
              <button
                onClick={() => toggleFavorite(dev)}
                className={`p-1 rounded ${dev.is_favorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl space-y-1.5 text-xs font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Hostname:</span>
                <span className="text-slate-200">{dev.hostname}</span>
              </div>
              <div className="flex justify-between">
                <span>Tailscale IP:</span>
                <span className="text-cyan-400">{dev.tailscale_ip}</span>
              </div>
              <div className="flex justify-between">
                <span>LAN IP:</span>
                <span className="text-slate-300">{dev.ip_address}</span>
              </div>
              <div className="flex justify-between">
                <span>OS / Kernel:</span>
                <span className="text-slate-300 truncate max-w-[180px]">{dev.os_info}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="text-emerald-400">{latencyMs}ms</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={() => {
                  setEditingDevice(dev);
                  setEditName(dev.name);
                }}
                className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs flex items-center justify-center space-x-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Rename Alias</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rename Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h4 className="font-semibold text-sm text-slate-100">Rename Device Alias</h4>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleUpdate}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs"
              >
                Save
              </button>
              <button
                onClick={() => setEditingDevice(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
