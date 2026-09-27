import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TermIcon, Plus, X, Trash2, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SessionTab {
  id: string;
  name: string;
}

export const TerminalView: React.FC = () => {
  const { systemInfo } = useApp();
  const [sessions, setSessions] = useState<SessionTab[]>([
    { id: 'session-1', name: 'Shell 1' },
    { id: 'session-2', name: 'Shell 2' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [output, setOutput] = useState<Record<string, string>>({
    'session-1': '',
    'session-2': ''
  });
  const [fontSize, setFontSize] = useState<number>(13);
  const [ctrlActive, setCtrlActive] = useState<boolean>(false);
  const [altActive, setAltActive] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const quickKeys = ['CTRL', 'ALT', 'TAB', 'ESC', '/', '~', '|', '&', '$', '>', '<', '{ }', '[ ]', '( )'];
  const suggestions = ['systemctl', 'journalctl', 'apt', 'git', 'python3', 'ip a', 'ss -tuln', 'ps aux', 'htop', 'uptime'];

  const getWsUrl = (sessionId: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/terminal?session_id=${sessionId}&rows=30&cols=90`;
  };

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(getWsUrl(activeSessionId));
    wsRef.current = ws;

    ws.onmessage = async (evt) => {
      let text = '';
      if (evt.data instanceof Blob) {
        text = await evt.data.text();
      } else {
        text = evt.data;
      }

      setOutput(prev => ({
        ...prev,
        [activeSessionId]: (prev[activeSessionId] || '') + text
      }));
    };

    return () => {
      ws.close();
    };
  }, [activeSessionId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output, activeSessionId]);

  const sendData = (data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendData('\r');
      if (inputRef.current) inputRef.current.value = '';
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      sendData('\x7f');
      e.preventDefault();
    } else if (e.key === 'Tab') {
      sendData('\t');
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      sendData('\x1b[A');
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      sendData('\x1b[B');
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      sendData('\x1b[C');
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      sendData('\x1b[D');
      e.preventDefault();
    } else if (e.ctrlKey || ctrlActive) {
      const code = e.key.toLowerCase().charCodeAt(0) - 96;
      if (code >= 1 && code <= 26) {
        sendData(String.fromCharCode(code));
        e.preventDefault();
      }
      setCtrlActive(false);
    }
  };

  const handleQuickKey = (key: string) => {
    if (key === 'CTRL') {
      setCtrlActive(!ctrlActive);
    } else if (key === 'ALT') {
      setAltActive(!altActive);
    } else if (key === 'TAB') {
      sendData('\t');
    } else if (key === 'ESC') {
      sendData('\x1b');
    } else if (key === '{ }') {
      sendData('{}');
    } else if (key === '[ ]') {
      sendData('[]');
    } else if (key === '( )') {
      sendData('()');
    } else {
      sendData(key);
    }
  };

  const sendCtrlC = () => sendData('\x03');
  const sendCtrlD = () => sendData('\x04');
  const sendCtrlZ = () => sendData('\x1a');

  const addSession = () => {
    const id = `session-${Date.now()}`;
    const name = `Shell ${sessions.length + 1}`;
    setSessions(prev => [...prev, { id, name }]);
    setActiveSessionId(id);
  };

  const closeSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) return;
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0].id);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#070b14] select-none">
      {/* Terminal Header & Session Tabs */}
      <div className="h-11 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between overflow-x-auto">
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-mono cursor-pointer border transition-all ${
                activeSessionId === s.id
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <TermIcon className="w-3 h-3" />
              <span>{s.name}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => closeSession(s.id, e)}
                  className="hover:text-rose-400 p-0.5 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSession}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
            title="New Terminal Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Font Controls & Clear */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white"
            title="Decrease font size"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400">{fontSize}px</span>
          <button
            onClick={() => setFontSize(prev => Math.min(20, prev + 1))}
            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white"
            title="Increase font size"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setOutput(prev => ({ ...prev, [activeSessionId]: '' }))}
            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-rose-400"
            title="Clear terminal screen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal View Output Container */}
      <div
        className="flex-1 overflow-y-auto p-4 font-mono leading-tight whitespace-pre-wrap select-text text-slate-200"
        style={{ fontSize: `${fontSize}px` }}
        onClick={() => inputRef.current?.focus()}
      >
        {output[activeSessionId] || (
          <div className="text-slate-600">
            [Smart Remote PTY v1.0 - Connected to {systemInfo?.hostname || 'kali'}:/bin/bash]
            <br />
            Type or tap commands below to interact with Kali Linux.
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Interactive Input Row */}
      <div className="bg-slate-950/90 border-t border-slate-800/80 p-2 flex items-center space-x-2">
        <span className="text-cyan-400 font-mono text-xs pl-2 font-bold">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const val = e.target.value;
            if (val) {
              sendData(val.slice(-1));
            }
          }}
          placeholder="Terminal input (type or tap keys)..."
          className="flex-1 bg-transparent border-none text-slate-100 font-mono text-xs focus:outline-none"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <div className="flex space-x-1">
          <button
            onClick={sendCtrlC}
            className="px-2 py-1 rounded bg-rose-950/60 border border-rose-800 text-rose-300 font-mono text-xs font-semibold hover:bg-rose-900"
            title="SIGINT (Ctrl+C)"
          >
            ^C
          </button>
          <button
            onClick={sendCtrlZ}
            className="px-2 py-1 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-mono text-xs font-semibold hover:bg-amber-900"
            title="SIGTSTP (Ctrl+Z)"
          >
            ^Z
          </button>
          <button
            onClick={sendCtrlD}
            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs font-semibold hover:bg-slate-800"
            title="EOF (Ctrl+D)"
          >
            ^D
          </button>
        </div>
      </div>

      {/* Quick Keys Bar */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-2 py-1.5 flex items-center space-x-1.5 overflow-x-auto">
        {quickKeys.map((k) => (
          <button
            key={k}
            onClick={() => handleQuickKey(k)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold shrink-0 transition-colors ${
              (k === 'CTRL' && ctrlActive) || (k === 'ALT' && altActive)
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Command Suggestions Chips */}
      <div className="bg-slate-950 border-t border-slate-800/80 px-2 py-1 flex items-center space-x-1.5 overflow-x-auto safe-bottom">
        <span className="text-[10px] text-slate-500 font-mono shrink-0 pl-1">Quick:</span>
        {suggestions.map((cmd) => (
          <button
            key={cmd}
            onClick={() => sendData(`${cmd}\r`)}
            className="px-2 py-0.5 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/40 text-cyan-300 font-mono text-[11px] shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
};
