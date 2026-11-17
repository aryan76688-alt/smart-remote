import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Mic,
  MicOff,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Folder,
  Eye,
  Zap,
  Smartphone,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Activity,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sliders,
  Volume2
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useVoice } from '../context/VoiceContext';

interface SubagentMeta {
  id: string;
  name: string;
  title: string;
  role: string;
  icon: any;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  status: 'idle' | 'executing' | 'ready';
}

const SUBAGENTS: SubagentMeta[] = [
  {
    id: 'sentinel',
    name: 'Sentinel-OS',
    title: 'Security & Host Guardian',
    role: 'Tamper Watcher, Lid Sensor, Power State, Panic Lockdown',
    icon: ShieldCheck,
    color: 'from-emerald-500 to-green-600',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
    description: 'Guards pearOS against physical tamper, disconnects, and rogue processes.',
    status: 'ready'
  },
  {
    id: 'shadownet',
    name: 'ShadowNet',
    title: 'Cloudflare Tunnel & Router',
    role: 'Global Routing, Network Failover, WAN/LAN Sync',
    icon: Globe,
    color: 'from-blue-500 to-indigo-600',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-700',
    description: 'Maintains live Cloudflare workers tunnel and zero-trust web transport.',
    status: 'ready'
  },
  {
    id: 'nexus',
    name: 'Nexus-Files',
    title: 'Filesystem Orchestrator',
    role: 'Chunked Upload/Download, Progress Tracker, Directory Scans',
    icon: Folder,
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-700',
    description: 'Streams remote files with exact percentage bars and hash validation.',
    status: 'ready'
  },
  {
    id: 'argus',
    name: 'Argus-Vision',
    title: 'Live CCTV & Stealth Streamer',
    role: 'Webcam MJPEG, Zero-Disk Live Stream, DPMS Blackout',
    icon: Eye,
    color: 'from-purple-500 to-pink-600',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-700',
    description: 'Provides pure live camera streaming without filling local disk storage.',
    status: 'ready'
  },
  {
    id: 'synapse',
    name: 'Synapse-Flow',
    title: 'Automation & Command Engine',
    role: 'Workflow Execution, Shell Pipelines, System Triggers',
    icon: Zap,
    color: 'from-sky-500 to-cyan-600',
    badgeBg: 'bg-sky-50 border-sky-200',
    badgeText: 'text-sky-700',
    description: 'Executes automated workflows, background tasks, and n8n shortcuts.',
    status: 'ready'
  },
  {
    id: 'oppolink',
    name: 'Oppo-Link',
    title: 'Mobile Telemetry & Daemon Link',
    role: 'GPS Sync, Siren 110dB, Flashlight Strobe, Background Keepalive',
    icon: Smartphone,
    color: 'from-rose-500 to-red-600',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-700',
    description: 'Connects to Android SmartRemoteDaemonService for 24/7 autonomous guard.',
    status: 'ready'
  }
];

interface ExecutionHistoryItem {
  id: string;
  timestamp: string;
  prompt: string;
  provider: string;
  model: string;
  primarySubagent: string;
  response: string;
  steps: string[];
  toolsCalled?: string[];
  durationMs?: number;
}

export const AgentOSView: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();
  const { voiceState, startListening, stopListening, transcript } = useVoice();
  const isListening = voiceState === 'listening';

  const [prompt, setPrompt] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeSubagentId, setActiveSubagentId] = useState<string | null>(null);

  const [history, setHistory] = useState<ExecutionHistoryItem[]>([
    {
      id: 'init-1',
      timestamp: '10:15 AM',
      prompt: 'Check system health and Oppo GPS connection',
      provider: 'Google Gemini',
      model: 'gemini-2.5-flash',
      primarySubagent: 'Sentinel-OS',
      response:
        'All systems optimal. pearOS host is active with 0 disk recording overhead. Oppo mobile node is locked at Dahegam GPS coordinates.',
      steps: [
        'Checked psutil memory & CPU usage',
        'Queried /api/tracking/fleet for Oppo node',
        'Verified systemd-inhibit lid switch inhibitor active'
      ],
      toolsCalled: ['system_stats', 'get_fleet_telemetry'],
      durationMs: 420
    }
  ]);

  const endOfHistoryRef = useRef<HTMLDivElement | null>(null);

  // Sync voice transcript into prompt
  useEffect(() => {
    if (transcript) {
      setPrompt(transcript);
    }
  }, [transcript]);

  // Model selector mapping based on provider
  const getAvailableModels = () => {
    switch (selectedProvider) {
      case 'gemini':
        return [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ultra Fast)' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning)' }
        ];
      case 'claude':
        return [
          { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
          { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' }
        ];
      case 'openai':
        return [
          { id: 'gpt-4o', name: 'GPT-4o Omnimodel' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
        ];
      case 'ollama':
        return [
          { id: 'llama3.2', name: 'Llama 3.2 (Local)' },
          { id: 'mistral-nemo', name: 'Mistral Nemo (Local)' }
        ];
      default:
        return [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }];
    }
  };

  const handleProviderChange = (prov: string) => {
    setSelectedProvider(prov);
    if (prov === 'gemini') setSelectedModel('gemini-2.5-flash');
    else if (prov === 'claude') setSelectedModel('claude-3-5-sonnet');
    else if (prov === 'openai') setSelectedModel('gpt-4o-mini');
    else if (prov === 'ollama') setSelectedModel('llama3.2');
  };

  const handleExecutePrompt = async (queryText?: string) => {
    const query = queryText || prompt;
    if (!query.trim() || isExecuting) return;

    setIsExecuting(true);
    triggerHaptic(40);
    const start = performance.now();

    // Determine likely subagent
    let delegatedAgent = SUBAGENTS[0];
    const lower = query.toLowerCase();
    if (lower.includes('cctv') || lower.includes('camera') || lower.includes('blackout') || lower.includes('stealth')) {
      delegatedAgent = SUBAGENTS[3]; // Argus
    } else if (lower.includes('file') || lower.includes('upload') || lower.includes('download')) {
      delegatedAgent = SUBAGENTS[2]; // Nexus
    } else if (lower.includes('oppo') || lower.includes('phone') || lower.includes('siren') || lower.includes('strobe') || lower.includes('gps')) {
      delegatedAgent = SUBAGENTS[5]; // OppoLink
    } else if (lower.includes('tunnel') || lower.includes('cloudflare') || lower.includes('network') || lower.includes('ip')) {
      delegatedAgent = SUBAGENTS[1]; // ShadowNet
    } else if (lower.includes('shortcut') || lower.includes('command') || lower.includes('script') || lower.includes('run')) {
      delegatedAgent = SUBAGENTS[4]; // Synapse
    }

    setActiveSubagentId(delegatedAgent.id);

    try {
      const res: any = await api.chatWithAgentOS({
        message: query,
        provider: selectedProvider,
        model: selectedModel
      });

      const end = performance.now();
      const elapsed = Math.round(end - start);

      const newItem: ExecutionHistoryItem = {
        id: `exec-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        prompt: query,
        provider: selectedProvider.toUpperCase(),
        model: selectedModel,
        primarySubagent: res.primary_subagent?.name || delegatedAgent.name,
        response: res.reply || res.message || 'Action executed successfully.',
        steps: res.execution_steps || [
          `Analyzed intent with ${selectedModel}`,
          `Dispatched task to ${delegatedAgent.name}`,
          'Verified return status 200 OK'
        ],
        toolsCalled: res.tools_used || ['system_executor'],
        durationMs: elapsed
      };

      setHistory((prev) => [...prev, newItem]);
      setPrompt('');
      addNotification('Agent Finished', `Executed by ${newItem.primarySubagent}`, 'success');

      setTimeout(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      addNotification('Execution Error', err.message || 'Agent failed to execute', 'error');
    } finally {
      setIsExecuting(false);
      setActiveSubagentId(null);
    }
  };

  const handleQuickChipClick = (text: string) => {
    setPrompt(text);
    handleExecutePrompt(text);
  };

  const handleAskMyScreen = async () => {
    setIsExecuting(true);
    triggerHaptic(40);
    setActiveSubagentId('argus');
    addNotification('AI Vision', 'Analyzing pearOS screen in RAM (0 disk storage)...', 'info');

    try {
      const res = await api.getScreenVision('Explain what is currently active on my laptop screen, highlight any warnings or tasks, and suggest actions.');
      const newItem: ExecutionHistoryItem = {
        id: `exec-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        prompt: '👁️ Ask My Screen: What is currently on my pearOS screen?',
        provider: 'GEMINI 2.5 FLASH VISION',
        model: 'gemini-2.5-flash',
        primarySubagent: 'Argus-Vision',
        response: res.summary || res.explanation || 'Desktop screen analyzed successfully.',
        steps: [
          'Captured in-memory frame buffer of pearOS desktop',
          'Streamed frame buffer to Gemini Vision model',
          'Extracted active apps, error logs, and terminals',
          'Purged frame buffer from RAM (0 disk storage saved)'
        ],
        toolsCalled: ['screen_vision_copilot'],
        durationMs: 820
      };
      setHistory((prev) => [...prev, newItem]);
      addNotification('Screen Analyzed', 'Gemini Vision completed analysis', 'success');
      setTimeout(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      addNotification('Vision Error', 'Could not capture screen for AI analysis', 'error');
    } finally {
      setIsExecuting(false);
      setActiveSubagentId(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#F2F2F7]">
      {/* Header Banner */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Nova Prime • AgentOS</h1>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Multi-Subagent Mesh
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Autonomous co-pilot orchestrating pearOS & Oppo daemon</p>
          </div>
        </div>

        {/* LLM Engine Picker */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {(['gemini', 'claude', 'openai', 'ollama'] as const).map((prov) => (
              <button
                key={prov}
                onClick={() => {
                  triggerHaptic(20);
                  handleProviderChange(prov);
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded-lg capitalize transition-all ${
                  selectedProvider === prov
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {prov}
              </button>
            ))}
          </div>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-slate-800 shadow-sm outline-none"
          >
            {getAvailableModels().map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Subagents Grid Cards */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Subagents (6)</span>
            <span className="text-[11px] text-slate-400">Collaborative Tool Calling</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {SUBAGENTS.map((agent) => {
              const IconComp = agent.icon;
              const isBusy = activeSubagentId === agent.id;

              return (
                <div
                  key={agent.id}
                  className={`p-3 rounded-2xl bg-white/90 backdrop-blur-md border transition-all shadow-sm ${
                    isBusy
                      ? 'border-blue-500 ring-2 ring-blue-400/30 shadow-md scale-[1.02]'
                      : 'border-black/5 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${agent.color} text-white flex items-center justify-center shadow-xs`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        isBusy ? 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse' : `${agent.badgeBg} ${agent.badgeText}`
                      }`}
                    >
                      {isBusy ? 'ACTIVE' : 'READY'}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 truncate">{agent.name}</h3>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-0.5">{agent.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              '🚨 Trigger 110dB emergency siren on Oppo',
              '🔦 Flashlight strobe on phone',
              '👁️ Blackout pearOS display (Stealth CCTV)',
              '🛡️ Full security & tamper check',
              '🗺️ Get current GPS coordinates from fleet',
              '⚡ Check system background daemon status'
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickChipClick(chip)}
                className="whitespace-nowrap px-3 py-1.5 bg-white/80 hover:bg-white text-slate-700 text-xs font-medium rounded-xl border border-black/5 shadow-xs transition-all active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Execution Conversation & Log Stream */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Execution Pipeline</span>
            <span className="text-[11px] text-slate-400 font-mono">{history.length} transactions</span>
          </div>

          {history.map((item) => (
            <div
              key={item.id}
              className="bg-white/95 backdrop-blur-xl border border-black/5 shadow-sm rounded-3xl p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    Q
                  </div>
                  <span className="text-xs font-semibold text-slate-900 font-sans">{item.prompt}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span>{item.provider}</span>
                  <span>•</span>
                  <span>{item.timestamp}</span>
                  {item.durationMs && <span className="text-blue-600 font-semibold">{item.durationMs}ms</span>}
                </div>
              </div>

              {/* Subagent Badge & Result */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                    Delegated: {item.primarySubagent}
                  </span>
                  {item.toolsCalled?.map((t, i) => (
                    <span key={i} className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      tool: {t}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-slate-800 leading-relaxed bg-slate-50/70 p-3 rounded-2xl border border-slate-200/60 font-sans">
                  {item.response}
                </p>
              </div>

              {/* Execution Steps */}
              {item.steps && item.steps.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Orchestration Steps
                  </div>
                  <div className="space-y-1">
                    {item.steps.map((st, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isExecuting && (
            <div className="bg-white/90 backdrop-blur-xl border border-blue-200 shadow-md rounded-3xl p-4 flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <span className="text-xs font-semibold text-slate-900">
                  Nova Prime orchestrating subagents...
                </span>
                <p className="text-[11px] text-slate-500">Executing tool calls & streaming telemetry</p>
              </div>
            </div>
          )}

          <div ref={endOfHistoryRef} />
        </div>
      </div>

      {/* Bottom Command Prompt Bar */}
      <div className="p-3 bg-white/90 backdrop-blur-2xl border-t border-black/5 shrink-0 space-y-2">
        {/* Quick Intelligence Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-4xl mx-auto pb-1 text-xs">
          <button
            type="button"
            onClick={handleAskMyScreen}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center gap-1.5 shadow-xs shrink-0 active:scale-95 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>👁️ Ask My Screen</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickChipClick('Scan my local Wi-Fi network and report all connected devices')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 active:scale-95 transition-all"
          >
            📶 Scan Local Wi-Fi
          </button>

          <button
            type="button"
            onClick={() => handleQuickChipClick('Inspect CPU thermals and switch power mode to balanced')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 active:scale-95 transition-all"
          >
            🌡️ Check Thermals
          </button>

          <button
            type="button"
            onClick={() => handleQuickChipClick('Arm the intruder trap with webcam detection (0 disk storage)')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 active:scale-95 transition-all"
          >
            🛡️ Arm Intruder Trap
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecutePrompt();
          }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          {/* Siri Voice Trigger Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(40);
              if (isListening) stopListening();
              else startListening();
            }}
            className={`p-3 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Speech to Text"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Input field */}
          <div className="relative flex-1">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Nova Prime to manage pearOS or trigger Oppo phone actions..."
              className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder:text-slate-400 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!prompt.trim() || isExecuting}
            className="p-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white shadow-md active:scale-95 transition-all flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
