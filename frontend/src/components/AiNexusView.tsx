import React, { useState } from 'react';
import { Bot, Terminal, Eye, Code, Mic, Send, Sparkles, CheckCircle2, Play } from 'lucide-react';
import { api } from '../services/api';

export const AiNexusView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'vision' | 'code' | 'meeting'>('terminal');

  // Terminal state
  const [terminalHistory, setTerminalHistory] = useState('npm run build\nerror: command failed');
  const [terminalResult, setTerminalResult] = useState<any>(null);

  // Vision state
  const [visionQuery, setVisionQuery] = useState('Explain what is currently on screen');
  const [visionResult, setVisionResult] = useState<any>(null);

  // Code REPL state
  const [replLang, setReplLang] = useState<'python' | 'bash'>('python');
  const [replCode, setReplCode] = useState('print("pearOS Nexus 3.0 In-RAM REPL Active")');
  const [replResult, setReplResult] = useState<any>(null);

  // Meeting state
  const [meetingText, setMeetingText] = useState('Reviewing background CCTV operations on mobile device, verifying lid close sleep prevention.');
  const [meetingResult, setMeetingResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const handleTerminalPredict = async () => {
    setLoading(true);
    try {
      const res = await api.predictTerminal(terminalHistory);
      setTerminalResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleVisionExplain = async () => {
    setLoading(true);
    try {
      const res = await api.explainVision(visionQuery);
      setVisionResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRepl = async () => {
    setLoading(true);
    try {
      const res = await api.runCodeRepl(replLang, replCode);
      setReplResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribeMeeting = async () => {
    setLoading(true);
    try {
      const res = await api.transcribeMeeting(meetingText);
      setMeetingResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Agent Selector Header */}
      <div className="grid grid-cols-4 gap-2 glass-panel p-2 rounded-2xl">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'terminal' ? 'bg-apple-blue text-white shadow-sm' : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          <Terminal size={16} />
          <span>Terminal</span>
        </button>
        <button
          onClick={() => setActiveTab('vision')}
          className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'vision' ? 'bg-apple-purple text-white shadow-sm' : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          <Eye size={16} />
          <span>Vision</span>
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'code' ? 'bg-apple-green text-white shadow-sm' : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          <Code size={16} />
          <span>Code REPL</span>
        </button>
        <button
          onClick={() => setActiveTab('meeting')}
          className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'meeting' ? 'bg-apple-orange text-white shadow-sm' : 'text-slate-600 hover:bg-white/50'
          }`}
        >
          <Mic size={16} />
          <span>Notes</span>
        </button>
      </div>

      {/* Active Co-Pilot Body */}
      <div className="flex-1 glass-panel rounded-3xl p-5 flex flex-col overflow-y-auto shadow-sm border border-white/80">
        {/* Terminal Pilot */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-apple-blue" />
              <h3 className="font-bold text-sm text-slate-800">Terminal Pilot Agent</h3>
            </div>
            <textarea
              value={terminalHistory}
              onChange={(e) => setTerminalHistory(e.target.value)}
              placeholder="Paste terminal log or error message..."
              rows={4}
              className="bg-white/70 border border-slate-200 rounded-2xl p-3 text-xs font-mono focus:ring-2 focus:ring-apple-blue focus:outline-none"
            />
            <button
              onClick={handleTerminalPredict}
              disabled={loading}
              className="w-full py-2.5 bg-apple-blue text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Sparkles size={14} />
              <span>{loading ? 'Analyzing...' : 'Predict Fix / Next Command'}</span>
            </button>

            {terminalResult && (
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2 animate-in fade-in">
                <span className="text-[10px] uppercase font-bold text-slate-400">Recommended Command:</span>
                <code className="bg-slate-900 text-apple-green font-mono text-xs p-2.5 rounded-xl block">
                  {terminalResult.predicted_command}
                </code>
                <span className="text-xs text-slate-600 mt-1 italic">{terminalResult.reasoning}</span>
                <button
                  onClick={() => api.typeText(terminalResult.predicted_command)}
                  className="mt-2 py-1.5 px-3 bg-apple-green text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Send size={12} />
                  <span>Type Into Active Cursor</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Vision Sentry */}
        {activeTab === 'vision' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <Eye size={20} className="text-apple-purple" />
              <h3 className="font-bold text-sm text-slate-800">Vision Sentry Co-Pilot</h3>
            </div>
            <input
              type="text"
              value={visionQuery}
              onChange={(e) => setVisionQuery(e.target.value)}
              placeholder="Query about screen or CCTV..."
              className="bg-white/70 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-apple-purple focus:outline-none"
            />
            <button
              onClick={handleVisionExplain}
              disabled={loading}
              className="w-full py-2.5 bg-apple-purple text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Sparkles size={14} />
              <span>{loading ? 'Analyzing Frame...' : 'Explain What I am Looking At'}</span>
            </button>

            {visionResult && (
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2 animate-in fade-in">
                <span className="text-[10px] uppercase font-bold text-slate-400">Analysis Output:</span>
                <p className="text-xs text-slate-700 leading-relaxed">{visionResult.explanation}</p>
                <div className="flex items-center gap-2 text-[11px] text-apple-green font-semibold mt-1">
                  <CheckCircle2 size={14} />
                  <span>Confidence: {(visionResult.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Architect REPL */}
        {activeTab === 'code' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code size={20} className="text-apple-green" />
                <h3 className="font-bold text-sm text-slate-800">In-RAM Code REPL</h3>
              </div>
              <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl">
                <button
                  onClick={() => setReplLang('python')}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${replLang === 'python' ? 'bg-white shadow-xs text-apple-blue' : 'text-slate-600'}`}
                >
                  Python
                </button>
                <button
                  onClick={() => setReplLang('bash')}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${replLang === 'bash' ? 'bg-white shadow-xs text-apple-blue' : 'text-slate-600'}`}
                >
                  Bash
                </button>
              </div>
            </div>
            <textarea
              value={replCode}
              onChange={(e) => setReplCode(e.target.value)}
              rows={4}
              className="bg-slate-900 text-slate-100 rounded-2xl p-3 text-xs font-mono focus:ring-2 focus:ring-apple-green focus:outline-none"
            />
            <button
              onClick={handleExecuteRepl}
              disabled={loading}
              className="w-full py-2 bg-apple-green text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Play size={14} />
              <span>{loading ? 'Executing...' : 'Run in RAM'}</span>
            </button>

            {replResult && (
              <div className="bg-slate-950 text-slate-200 p-3 rounded-2xl font-mono text-xs flex flex-col gap-1 overflow-x-auto max-h-36">
                <span className="text-[10px] text-slate-500 uppercase">Stdout ({replResult.execution_ms}ms):</span>
                <pre className="text-apple-green whitespace-pre-wrap">{replResult.output}</pre>
              </div>
            )}
          </div>
        )}

        {/* Meeting Transcriber */}
        {activeTab === 'meeting' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
              <Mic size={20} className="text-apple-orange" />
              <h3 className="font-bold text-sm text-slate-800">Meeting Notes Transcriber</h3>
            </div>
            <textarea
              value={meetingText}
              onChange={(e) => setMeetingText(e.target.value)}
              placeholder="Paste raw transcript or talk summary..."
              rows={3}
              className="bg-white/70 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-apple-orange focus:outline-none"
            />
            <button
              onClick={handleTranscribeMeeting}
              disabled={loading}
              className="w-full py-2.5 bg-apple-orange text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Sparkles size={14} />
              <span>{loading ? 'Structuring...' : 'Generate Action Items'}</span>
            </button>

            {meetingResult && (
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2 animate-in fade-in">
                <h4 className="text-xs font-bold text-slate-800">{meetingResult.summary}</h4>
                <div className="flex flex-col gap-1 mt-1">
                  {meetingResult.action_items.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="text-apple-orange font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
