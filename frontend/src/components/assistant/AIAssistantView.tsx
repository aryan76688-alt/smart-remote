import React, { useState } from 'react';
import { Bot, Send, Terminal, Play, AlertTriangle, Check, Sparkles, HelpCircle } from 'lucide-react';
import { api } from '../../services/api';
import { AssistantMessage } from '../../types';
import { useApp } from '../../context/AppContext';

export const AIAssistantView: React.FC = () => {
  const { setActiveRoute, addNotification } = useApp();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your Kali Linux Smart Assistant. I can help analyze your system, generate commands, troubleshoot errors, and navigate Smart Remote.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputVal, setInputVal] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [confirmingCommand, setConfirmingCommand] = useState<string | null>(null);

  const promptChips = [
    'Show CPU usage',
    'Find large files',
    'Check open ports',
    'Why is my network slow?',
    'Show running services',
    'Open Terminal'
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim() || loading) return;

    const userMsg: AssistantMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const res = await api.chatAssistant(text);
      const botMsg: AssistantMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: res.reply,
        suggested_command: res.suggested_command,
        is_destructive: res.is_destructive,
        requires_confirmation: res.requires_confirmation,
        action_type: res.action_type,
        navigation_route: res.navigation_route,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, botMsg]);

      // If navigation action
      if (res.action_type === 'navigate' && res.navigation_route) {
        setTimeout(() => setActiveRoute(res.navigation_route!), 1200);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: 'Failed to contact assistant service.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (cmd: string, confirmed = false) => {
    try {
      const res = await api.executeCommand(cmd, confirmed);
      const resultMsg: AssistantMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: `Executed \`${cmd}\` (Exit Code: ${res.exit_code}):\n\n\`\`\`\n${res.stdout || res.stderr || '(No output)'}\n\`\`\``,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, resultMsg]);
      setConfirmingCommand(null);
      addNotification('Command Executed', cmd, res.exit_code === 0 ? 'success' : 'error');
    } catch (err: any) {
      addNotification('Execution Error', err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-cyber-bg max-w-4xl mx-auto w-full select-none">
      {/* Header */}
      <div className="bg-cyber-surface border-b border-cyber-border p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300">
          <Bot className="w-5 h-5 text-cyan-400" />
          <span className="font-bold">KALI AI COMMAND ASSISTANT</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2.5 ${
                msg.role === 'user'
                  ? 'bg-cyan-600/30 border border-cyan-500/50 text-slate-100 rounded-tr-none'
                  : 'bg-cyber-surface border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Navigation Button */}
              {msg.action_type === 'navigate' && msg.navigation_route && (
                <button
                  onClick={() => setActiveRoute(msg.navigation_route!)}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1"
                >
                  <span>Go to {msg.navigation_route}</span>
                </button>
              )}

              {/* Suggested Command Card */}
              {msg.suggested_command && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Generated Command</span>
                    {msg.is_destructive && (
                      <span className="text-rose-400 flex items-center space-x-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Requires Confirmation</span>
                      </span>
                    )}
                  </div>
                  <pre className="p-2 bg-slate-900 rounded font-mono text-xs text-cyan-300 overflow-x-auto">
                    {msg.suggested_command}
                  </pre>
                  <div className="flex space-x-2">
                    {msg.is_destructive ? (
                      <button
                        onClick={() => setConfirmingCommand(msg.suggested_command!)}
                        className="py-1.5 px-3 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 font-bold rounded-lg text-xs flex items-center space-x-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Confirm &amp; Run</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExecute(msg.suggested_command!, false)}
                        className="py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Execute Command</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 font-mono p-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Analyzing system &amp; preparing response...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="p-2 border-t border-cyber-border bg-cyber-surface/60 flex items-center space-x-1.5 overflow-x-auto">
        {promptChips.map(chip => (
          <button
            key={chip}
            onClick={() => handleSend(chip)}
            className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Row */}
      <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="p-3 bg-cyber-surface border-t border-cyber-border flex items-center space-x-2 safe-bottom">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="Ask Kali AI: 'Find large files', 'Explain ss -tuln', etc..."
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !inputVal.trim()}
          className="p-2 bg-gradient-to-r from-cyan-600 to-emerald-600 text-slate-950 font-bold rounded-xl disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Destructive Command Confirmation Modal */}
      {confirmingCommand && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-surface border border-rose-800 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Dangerous Command Confirmation</h3>
            </div>
            <p className="text-xs text-slate-300">
              This command may alter system files or state. Execute?
            </p>
            <pre className="p-2 bg-slate-950 rounded font-mono text-xs text-rose-300 overflow-x-auto">
              {confirmingCommand}
            </pre>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => handleExecute(confirmingCommand, true)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
              >
                Execute
              </button>
              <button
                onClick={() => setConfirmingCommand(null)}
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
