import React, { useState } from 'react';
import { Bot, Terminal, Eye, Code, Mic, Send, Sparkles, CheckCircle2, Play } from 'lucide-react';
import { api } from '../services/api';

export const AiNexusView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'vision' | 'code' | 'meeting'>('terminal');
  const [terminalHistory, setTerminalHistory] = useState('systemctl --user status smart-remote.service');
  const [terminalResult, setTerminalResult] = useState<any>(null);
  const [visionQuery, setVisionQuery] = useState('Analyze active pearOS display and CCTV perimeter');
  const [visionResult, setVisionResult] = useState<any>(null);
  const [replLang, setReplLang] = useState<'python' | 'bash'>('python');
  const [replCode, setReplCode] = useState('print("pearOS Nexus 4.0 Light Liquid Glass REPL Ready")');
  const [replResult, setReplResult] = useState<any>(null);
  const [meetingText, setMeetingText] = useState('Verify 30-minute CCTV background recording and mobile lockscreen continuity.');
  const [meetingResult, setMeetingResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runAction = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  return (
    <div className="w-full h-full px-3 pb-4 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-md flex flex-col gap-3">
        {/* Light Agent Switcher */}
        <div className="grid grid-cols-4 gap-1.5 liquid-glass rounded-2xl p-1.5">
          {[
            { id: 'terminal', label: 'Terminal', icon: Terminal, active: 'bg-stitch-primaryStrong text-white shadow-sm' },
            { id: 'vision', label: 'Vision', icon: Eye, active: 'bg-stitch-tertiaryStrong text-white shadow-sm' },
            { id: 'code', label: 'REPL', icon: Code, active: 'bg-stitch-secondaryStrong text-white shadow-sm' },
            { id: 'meeting', label: 'Notes', icon: Mic, active: 'bg-amber-500 text-white shadow-sm' },
          ].map(({ id, label, icon: Icon, active }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as any)}
              className={`min-h-[48px] py-2 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                activeTab === id ? active : 'text-stitch-muted hover:bg-white/60'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Light Crystal Agent Card */}
        <div className="liquid-glass rounded-3xl p-4 flex flex-col gap-3.5">
          {activeTab === 'terminal' && (
            <>
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-stitch-primaryStrong" />
                <h3 className="font-display font-bold text-sm text-stitch-text">Terminal Pilot Agent</h3>
              </div>
              <textarea
                value={terminalHistory}
                onChange={(e) => setTerminalHistory(e.target.value)}
                rows={4}
                className="bg-white/75 border border-slate-900/10 rounded-2xl p-3 text-xs font-mono text-stitch-text focus:outline-none focus:border-stitch-primaryStrong"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => runAction(async () => setTerminalResult(await api.predictTerminal(terminalHistory)))}
                className="w-full min-h-[44px] rounded-2xl bg-stitch-primaryStrong text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(0,122,255,0.32)] active:scale-95"
              >
                <Sparkles size={14} />
                <span>{loading ? 'Analyzing...' : 'Predict Fix / Command'}</span>
              </button>
              {terminalResult && (
                <div className="liquid-glass-deep rounded-2xl p-3.5 flex flex-col gap-2">
                  <code className="text-xs font-mono font-semibold text-stitch-primary bg-white/80 p-2 rounded-xl border border-slate-900/10">
                    {terminalResult.predicted_command}
                  </code>
                  <p className="text-[11px] text-stitch-muted">{terminalResult.reasoning}</p>
                  <button
                    type="button"
                    onClick={() => api.typeText(terminalResult.predicted_command)}
                    className="py-2 rounded-xl bg-stitch-secondaryStrong text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Send size={12} />
                    <span>Type Into pearOS</span>
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'vision' && (
            <>
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-stitch-tertiary" />
                <h3 className="font-display font-bold text-sm text-stitch-text">Vision Sentry Co-Pilot</h3>
              </div>
              <input
                type="text"
                value={visionQuery}
                onChange={(e) => setVisionQuery(e.target.value)}
                className="bg-white/75 border border-slate-900/10 rounded-2xl p-3 text-xs text-stitch-text focus:outline-none focus:border-stitch-tertiaryStrong"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => runAction(async () => setVisionResult(await api.explainVision(visionQuery)))}
                className="w-full min-h-[44px] rounded-2xl bg-stitch-tertiaryStrong text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(147,51,234,0.32)] active:scale-95"
              >
                <Sparkles size={14} />
                <span>{loading ? 'Inspecting...' : 'Analyze Display / CCTV'}</span>
              </button>
              {visionResult && (
                <div className="liquid-glass-deep rounded-2xl p-3.5 flex flex-col gap-2">
                  <p className="text-xs text-stitch-text leading-relaxed">{visionResult.explanation}</p>
                  <span className="text-[11px] font-mono font-semibold text-stitch-secondary flex items-center gap-1">
                    <CheckCircle2 size={13} /> Confidence {(visionResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </>
          )}

          {activeTab === 'code' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-stitch-secondary" />
                  <h3 className="font-display font-bold text-sm text-stitch-text">In-RAM Code REPL</h3>
                </div>
                <div className="flex gap-1 liquid-glass-deep p-1 rounded-xl">
                  {(['python', 'bash'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setReplLang(lang)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase ${
                        replLang === lang ? 'bg-stitch-secondaryStrong text-white shadow-xs' : 'text-stitch-muted'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={replCode}
                onChange={(e) => setReplCode(e.target.value)}
                rows={4}
                className="bg-white/80 border border-slate-900/10 rounded-2xl p-3 text-xs font-mono text-stitch-primary focus:outline-none focus:border-stitch-secondaryStrong"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => runAction(async () => setReplResult(await api.runCodeRepl(replLang, replCode)))}
                className="w-full min-h-[44px] rounded-2xl bg-stitch-secondaryStrong text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(34,197,94,0.32)] active:scale-95"
              >
                <Play size={14} />
                <span>{loading ? 'Running...' : 'Execute in RAM'}</span>
              </button>
              {replResult && (
                <div className="bg-white/80 border border-slate-900/10 rounded-2xl p-3 font-mono text-xs overflow-x-auto max-h-40">
                  <span className="text-[10px] text-stitch-outline block mb-1">STDOUT ({replResult.execution_ms}ms)</span>
                  <pre className="text-stitch-secondary font-semibold whitespace-pre-wrap">{replResult.output}</pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'meeting' && (
            <>
              <div className="flex items-center gap-2">
                <Mic size={18} className="text-amber-600" />
                <h3 className="font-display font-bold text-sm text-stitch-text">Meeting Transcriber</h3>
              </div>
              <textarea
                value={meetingText}
                onChange={(e) => setMeetingText(e.target.value)}
                rows={3}
                className="bg-white/75 border border-slate-900/10 rounded-2xl p-3 text-xs text-stitch-text focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => runAction(async () => setMeetingResult(await api.transcribeMeeting(meetingText)))}
                className="w-full min-h-[44px] rounded-2xl bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(245,158,11,0.32)] active:scale-95"
              >
                <Sparkles size={14} />
                <span>{loading ? 'Structuring...' : 'Extract Action Items'}</span>
              </button>
              {meetingResult && (
                <div className="liquid-glass-deep rounded-2xl p-3.5 flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold text-stitch-text">{meetingResult.summary}</h4>
                  {meetingResult.action_items.map((item: string, i: number) => (
                    <div key={i} className="text-xs text-stitch-muted flex gap-2">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
