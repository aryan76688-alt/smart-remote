import React, { useState } from 'react';
import { Terminal, Eye, Code, Mic, Send, Sparkles, Play } from 'lucide-react';
import { api } from '../services/api';

export const AiNexusView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'vision' | 'code' | 'meeting'>('terminal');
  const [terminalHistory, setTerminalHistory] = useState('systemctl --user status smart-remote.service');
  const [terminalResult, setTerminalResult] = useState<any>(null);
  const [visionQuery, setVisionQuery] = useState('Analyze active pearOS display and CCTV perimeter');
  const [visionResult, setVisionResult] = useState<any>(null);
  const [replLang, setReplLang] = useState<'python' | 'bash'>('python');
  const [replCode, setReplCode] = useState('print("pearOS Nexus Apple Liquid Glass Ready")');
  const [replResult, setReplResult] = useState<any>(null);
  const [meetingText, setMeetingText] = useState('Verify 30-minute CCTV background recording and mobile lockscreen continuity.');
  const [meetingResult, setMeetingResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runAction = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  return (
    <div className="w-full h-full px-4 pb-8 overflow-y-auto">
      <div className="max-w-[980px] mx-auto flex flex-col gap-4">
        {/* Configurator Option Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'terminal', label: 'Terminal Pilot', icon: Terminal },
            { id: 'vision', label: 'Vision Sentry', icon: Eye },
            { id: 'code', label: 'Code REPL', icon: Code },
            { id: 'meeting', label: 'Meeting Notes', icon: Mic },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as any)}
              className={`min-h-[44px] px-4 py-2 type-caption flex items-center gap-2 ${
                activeTab === id ? 'apple-option-chip-selected font-semibold' : 'apple-option-chip'
              }`}
            >
              <Icon size={15} className="text-apple-primary" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Agent Utility Card (18px) */}
        <div className="apple-glass-card p-6 flex flex-col gap-4">
          {activeTab === 'terminal' && (
            <>
              <h3 className="type-tagline text-apple-ink">Terminal Pilot</h3>
              <textarea
                value={terminalHistory}
                onChange={(e) => setTerminalHistory(e.target.value)}
                rows={4}
                className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 type-caption font-mono text-apple-ink"
              />
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(async () => setTerminalResult(await api.predictTerminal(terminalHistory)))}
                  className="apple-btn-primary px-6 py-3 type-caption inline-flex items-center gap-2 min-h-[44px]"
                >
                  <Sparkles size={15} />
                  <span>{loading ? 'Analyzing...' : 'Predict Fix'}</span>
                </button>
              </div>
              {terminalResult && (
                <div className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 flex flex-col gap-3">
                  <code className="type-caption font-mono font-semibold text-apple-ink">{terminalResult.predicted_command}</code>
                  <p className="type-caption text-apple-ink80">{terminalResult.reasoning}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => api.typeText(terminalResult.predicted_command)}
                      className="apple-btn-secondary px-4 py-2 type-caption inline-flex items-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>Type Into pearOS</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'vision' && (
            <>
              <h3 className="type-tagline text-apple-ink">Vision Sentry</h3>
              <input
                type="text"
                value={visionQuery}
                onChange={(e) => setVisionQuery(e.target.value)}
                className="apple-search-input px-5 type-caption"
              />
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(async () => setVisionResult(await api.explainVision(visionQuery)))}
                  className="apple-btn-primary px-6 py-3 type-caption inline-flex items-center gap-2 min-h-[44px]"
                >
                  <Sparkles size={15} />
                  <span>{loading ? 'Inspecting...' : 'Analyze Display'}</span>
                </button>
              </div>
              {visionResult && (
                <div className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 flex flex-col gap-2">
                  <p className="type-body text-apple-ink">{visionResult.explanation}</p>
                  <span className="type-fine font-mono text-apple-ink48">
                    Confidence {(visionResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </>
          )}

          {activeTab === 'code' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="type-tagline text-apple-ink">In-RAM Code REPL</h3>
                <div className="flex gap-2">
                  {(['python', 'bash'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setReplLang(lang)}
                      className={`px-3.5 py-1.5 type-fine font-mono uppercase ${
                        replLang === lang ? 'apple-option-chip-selected font-semibold' : 'apple-option-chip'
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
                className="bg-apple-tile1 text-white rounded-apple-lg p-4 type-caption font-mono"
              />
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(async () => setReplResult(await api.runCodeRepl(replLang, replCode)))}
                  className="apple-btn-primary px-6 py-3 type-caption inline-flex items-center gap-2 min-h-[44px]"
                >
                  <Play size={14} />
                  <span>{loading ? 'Running...' : 'Run in RAM'}</span>
                </button>
              </div>
              {replResult && (
                <div className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 font-mono type-caption overflow-x-auto">
                  <span className="type-micro text-apple-ink48 block mb-1">STDOUT · {replResult.execution_ms}ms</span>
                  <pre className="text-apple-ink whitespace-pre-wrap">{replResult.output}</pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'meeting' && (
            <>
              <h3 className="type-tagline text-apple-ink">Meeting Transcriber</h3>
              <textarea
                value={meetingText}
                onChange={(e) => setMeetingText(e.target.value)}
                rows={3}
                className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 type-caption text-apple-ink"
              />
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAction(async () => setMeetingResult(await api.transcribeMeeting(meetingText)))}
                  className="apple-btn-primary px-6 py-3 type-caption inline-flex items-center gap-2 min-h-[44px]"
                >
                  <Sparkles size={15} />
                  <span>{loading ? 'Summarizing...' : 'Extract Action Items'}</span>
                </button>
              </div>
              {meetingResult && (
                <div className="bg-apple-parchment border border-apple-hairline rounded-apple-lg p-4 flex flex-col gap-2">
                  <h4 className="type-body-strong text-apple-ink">{meetingResult.summary}</h4>
                  {meetingResult.action_items.map((item: string, i: number) => (
                    <p key={i} className="type-caption text-apple-ink80">• {item}</p>
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
