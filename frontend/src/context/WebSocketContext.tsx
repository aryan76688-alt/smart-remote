import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { SystemStats } from '../types';

interface WebSocketContextType {
  inputConnected: boolean;
  systemConnected: boolean;
  latencyMs: number;
  systemStats: SystemStats | null;
  sendInput: (payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [inputConnected, setInputConnected] = useState<boolean>(false);
  const [systemConnected, setSystemConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(32);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  const inputWs = useRef<WebSocket | null>(null);
  const systemWs = useRef<WebSocket | null>(null);
  const pingInterval = useRef<number | undefined>(undefined);

  const getWsUrl = (path: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${path}`;
  };

  // Connect Input WS
  useEffect(() => {
    let unmounted = false;
    let reconnectTimeout: number | undefined = undefined;

    const connectInput = () => {
      if (unmounted) return;
      try {
        const ws = new WebSocket(getWsUrl('/ws/input'));
        inputWs.current = ws;

        ws.onopen = () => {
          if (!unmounted) setInputConnected(true);
        };

        ws.onclose = () => {
          if (!unmounted) {
            setInputConnected(false);
            reconnectTimeout = window.setTimeout(connectInput, 2000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimeout = window.setTimeout(connectInput, 3000);
      }
    };

    connectInput();

    return () => {
      unmounted = true;
      if (reconnectTimeout !== undefined) clearTimeout(reconnectTimeout);
      if (inputWs.current) inputWs.current.close();
    };
  }, []);

  // Connect System WS
  useEffect(() => {
    let unmounted = false;
    let reconnectTimeout: number | undefined = undefined;

    const connectSystem = () => {
      if (unmounted) return;
      try {
        const ws = new WebSocket(getWsUrl('/ws/system'));
        systemWs.current = ws;

        ws.onopen = () => {
          if (!unmounted) setSystemConnected(true);
        };

        ws.onmessage = (evt) => {
          if (!unmounted && evt.data) {
            try {
              const data = JSON.parse(evt.data);
              setSystemStats(data);
            } catch {
              // ignore
            }
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            setSystemConnected(false);
            reconnectTimeout = window.setTimeout(connectSystem, 2500);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimeout = window.setTimeout(connectSystem, 3000);
      }
    };

    connectSystem();

    return () => {
      unmounted = true;
      if (reconnectTimeout !== undefined) clearTimeout(reconnectTimeout);
      if (systemWs.current) systemWs.current.close();
    };
  }, []);

  // Latency Ping Interval
  useEffect(() => {
    const checkLatency = async () => {
      const start = performance.now();
      try {
        await fetch('/api/devices/ping', { method: 'POST' });
        const delta = Math.round(performance.now() - start);
        setLatencyMs(delta);
      } catch {
        setLatencyMs(999);
      }
    };

    checkLatency();
    pingInterval.current = window.setInterval(checkLatency, 5000);

    return () => {
      if (pingInterval.current !== undefined) clearInterval(pingInterval.current);
    };
  }, []);

  const sendInput = (payload: any) => {
    if (inputWs.current && inputWs.current.readyState === WebSocket.OPEN) {
      inputWs.current.send(JSON.stringify(payload));
    }
  };

  return (
    <WebSocketContext.Provider value={{
      inputConnected,
      systemConnected,
      latencyMs,
      systemStats,
      sendInput
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};
