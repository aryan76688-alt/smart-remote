import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { SystemStats } from '../types';

export type BandwidthMode = 'low' | 'balanced' | 'high';

interface WebSocketContextType {
  inputConnected: boolean;
  systemConnected: boolean;
  latencyMs: number;
  systemStats: SystemStats | null;
  networkType: 'tailscale' | 'cloudflare' | 'local';
  networkLabel: string;
  bandwidthMode: BandwidthMode;
  setBandwidthMode: (mode: BandwidthMode) => void;
  sendInput: (payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [inputConnected, setInputConnected] = useState<boolean>(false);
  const [systemConnected, setSystemConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(25);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [bandwidthMode, setBandwidthModeState] = useState<BandwidthMode>(() => {
    return (localStorage.getItem('smartremote_bandwidth_mode') as BandwidthMode) || 'low';
  });

  const inputWs = useRef<WebSocket | null>(null);
  const systemWs = useRef<WebSocket | null>(null);
  const pingInterval = useRef<number | undefined>(undefined);

  // Network Detection
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const networkType: 'tailscale' | 'cloudflare' | 'local' = 
    hostname.startsWith('100.') || hostname === '100.69.194.11'
      ? 'tailscale'
      : hostname.includes('trycloudflare.com') || hostname.includes('cloudflare')
      ? 'cloudflare'
      : 'local';

  const networkLabel = 
    networkType === 'tailscale'
      ? 'Tailscale Direct P2P'
      : networkType === 'cloudflare'
      ? 'Cloudflare Global Tunnel'
      : 'Local Network (Wi-Fi)';

  const setBandwidthMode = (mode: BandwidthMode) => {
    setBandwidthModeState(mode);
    try {
      localStorage.setItem('smartremote_bandwidth_mode', mode);
    } catch {}
  };

  const getWsUrl = (path: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${path}`;
  };

  // Connect Input WS (Zero-latency native input events + sub-millisecond RTT ping)
  useEffect(() => {
    let unmounted = false;
    let reconnectTimeout: number | undefined = undefined;

    const connectInput = () => {
      if (unmounted) return;
      try {
        const ws = new WebSocket(getWsUrl('/ws/input'));
        inputWs.current = ws;

        ws.onopen = () => {
          if (!unmounted) {
            setInputConnected(true);
            // Send initial ping immediately upon connection
            ws.send(JSON.stringify({ type: 'ping', client_ts: performance.now() }));
          }
        };

        ws.onmessage = (evt) => {
          if (unmounted || !evt.data) return;
          try {
            const data = JSON.parse(evt.data);
            if (data.type === 'pong' && typeof data.client_ts === 'number') {
              const rtt = Math.round(performance.now() - data.client_ts);
              setLatencyMs(Math.max(1, rtt));
            }
          } catch {}
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

  // Continuous Low-Overhead RTT Ping (WebSocket first, fallback to HTTP)
  useEffect(() => {
    const doPing = async () => {
      if (inputWs.current && inputWs.current.readyState === WebSocket.OPEN) {
        inputWs.current.send(JSON.stringify({ type: 'ping', client_ts: performance.now() }));
      } else {
        const start = performance.now();
        try {
          await fetch('/api/devices/ping', { method: 'POST' });
          const delta = Math.round(performance.now() - start);
          setLatencyMs(delta);
        } catch {
          setLatencyMs(999);
        }
      }
    };

    doPing();
    pingInterval.current = window.setInterval(doPing, 2500);

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
      networkType,
      networkLabel,
      bandwidthMode,
      setBandwidthMode,
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
