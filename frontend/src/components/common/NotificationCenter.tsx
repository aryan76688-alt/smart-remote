import React from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, clearNotifications } = useApp();

  if (!isOpen) return null;

  const getIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-sm bg-cyber-surface border-l border-cyber-border h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-4 border-b border-cyber-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Notification Center
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {notifications.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No recent notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 text-xs"
              >
                <div className="flex items-center space-x-2">
                  {getIcon(n.level)}
                  <span className="font-semibold text-slate-200">{n.title}</span>
                </div>
                <p className="text-slate-400 pl-6 leading-relaxed text-[11px]">{n.message}</p>
                <div className="text-[10px] font-mono text-slate-600 pl-6 pt-1">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-cyber-border">
            <button
              onClick={clearNotifications}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Notifications</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
