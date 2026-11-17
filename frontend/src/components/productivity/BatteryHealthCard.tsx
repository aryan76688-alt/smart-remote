import React, { useState, useEffect } from 'react';
import { Battery, BatteryCharging, BatteryWarning, Zap, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export const BatteryHealthCard: React.FC = () => {
  const [battery, setBattery] = useState<{
    percentage: number;
    status: string;
    is_plugged: boolean;
    overcharge_warning: boolean;
    low_battery_warning: boolean;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBattery = async () => {
    try {
      const res = await api.getBattery();
      setBattery(res);
    } catch (e) {
      console.error('Failed to get battery info:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBattery();
    const interval = setInterval(fetchBattery, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!battery) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${battery.is_plugged ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {battery.is_plugged ? <BatteryCharging className="w-5 h-5" /> : <Battery className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Laptop Power & Battery</h3>
            <p className="text-xs text-slate-400">{battery.status} • {battery.is_plugged ? 'AC Connected' : 'On Battery'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-white">{battery.percentage}%</span>
          <button onClick={fetchBattery} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            battery.percentage > 40
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
              : (battery.percentage > 20 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse')
          }`}
          style={{ width: `${Math.max(5, battery.percentage)}%` }}
        />
      </div>

      {battery.overcharge_warning && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mt-2">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>Battery is fully charged (98%+). Unplug charger to preserve battery lifespan!</span>
        </div>
      )}

      {battery.low_battery_warning && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 mt-2">
          <BatteryWarning className="w-4 h-4 flex-shrink-0" />
          <span>Low battery warning! Connect your laptop charger soon.</span>
        </div>
      )}
    </div>
  );
};
