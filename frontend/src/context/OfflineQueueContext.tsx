import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

export interface QueuedAction {
  id: string;
  name: string;
  timestamp: number;
  type: 'command' | 'quick_action' | 'media' | 'workspace';
  payload: any;
}

interface OfflineQueueContextType {
  isOffline: boolean;
  queuedActions: QueuedAction[];
  enqueueAction: (name: string, type: QueuedAction['type'], payload: any) => void;
  flushQueue: () => Promise<void>;
  clearQueue: () => void;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);

export const OfflineQueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() => {
    try {
      const saved = localStorage.getItem('smart_remote_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveQueue = (items: QueuedAction[]) => {
    setQueuedActions(items);
    localStorage.setItem('smart_remote_offline_queue', JSON.stringify(items));
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      flushQueue();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queuedActions]);

  const enqueueAction = (name: string, type: QueuedAction['type'], payload: any) => {
    const item: QueuedAction = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name,
      timestamp: Date.now(),
      type,
      payload
    };
    const updated = [...queuedActions, item];
    saveQueue(updated);
  };

  const flushQueue = async () => {
    if (queuedActions.length === 0) return;
    const current = [...queuedActions];
    saveQueue([]);

    for (const item of current) {
      try {
        if (item.type === 'command') {
          await api.executeCommand(item.payload, true);
        } else if (item.type === 'media') {
          await api.sendMediaAction(item.payload);
        } else if (item.type === 'workspace') {
          await api.switchWorkspace(item.payload);
        } else if (item.type === 'quick_action') {
          await fetch('/api/system/quick-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: item.payload })
          });
        }
      } catch (e) {
        console.warn(`[OFFLINE-QUEUE] Failed executing queued action ${item.name}:`, e);
      }
    }
  };

  const clearQueue = () => {
    saveQueue([]);
  };

  return (
    <OfflineQueueContext.Provider
      value={{
        isOffline,
        queuedActions,
        enqueueAction,
        flushQueue,
        clearQueue
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
};

export const useOfflineQueue = (): OfflineQueueContextType => {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
};
