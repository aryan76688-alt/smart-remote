import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  X, Sparkles, Terminal, Code2, FileText, Globe, GitCommit, 
  Play, Check, Copy, Languages, AlertCircle, RefreshCw
} from 'lucide-react';

interface AiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiCopilotModal: React.FC<AiCopilotModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'repl' | 'git' | 'query' | 'meeting' | 'summary' | 'logs'>('repl');
  
  // REPL State
  const [replLang, setReplLang] = useState<'python' | 'bash' | 'node'>('python');
  const [replCode, setReplCode] = useState('print("pearOS Smart Remote v2.0 - Active")');
  const [replOutput, setReplOutput] = useState('');
  const [replLoading, setReplLoading] = useState(false);

  // Git Commit State
  const [gitStat, setGitStat] = useState('');
  const [gitMsg, setGitMsg] = useState('');
  const [gitLoading, setGitLoading] = useState(false);

  // Query Generator State
  const [queryPrompt, setQueryPrompt] = useState('match email addresses');
  const [queryTarget, setQueryTarget] = useState<'regex' | 'sql'>('regex');
  const [queryResult, setQueryResult] = useState('');

  // Meeting State
  const [meetingSummary, setMeetingSummary] = useState('');
  const [meetingActions, setMeetingActions] = useState<string[]>([]);
  const [meetingLoading, setMeetingLoading] = useState(false);

  // Web Summarizer State
  const [webUrl, setWebUrl] = useState('https://pearos.org');
  const [webSummary, setWebSummary] = useState('');
  const [webLoading, setWebLoading] = useState(false);

  // Anomaly Logs
  const [logLogs, setLogLogs] = useState<Array<{ level: string; text: string }>>([]);
  const [logScore, setLogScore] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRunRepl = async () => {
    setReplLoading(true);
    try {
      const res = await api.executeCodeRepl(replLang, replCode);
      setReplOutput(res.stdout || res.stderr || 'No output');
    } catch (e: any) {
      setReplOutput(String(e));
    } finally {
      setReplLoading(false);
    }
  };

  const handleFetchGitAutopilot = async () => {
    setGitLoading(true);
    try {
      const res = await api.getGitCommitAutopilot();
      if (res.success) {
        setGitStat(res.git_stat);
        setGitMsg(res.suggested_message);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setGitLoading(false);
    }
  };

  const handleRunQueryGen = async () => {
    try {
      const res = await api.generateQuery(queryPrompt, queryTarget);
      if (res.success) {
        setQueryResult(res.generated_code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunMeetingTranscribe = async () => {
    setMeetingLoading(true);
    try {
      const res = await api.meetingTranscribe();
      if (res.success) {
        setMeetingSummary(res.summary);
        setMeetingActions(res.action_items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleRunWebSummarize = async () => {
    setWebLoading(true);
    try {
      const res = await api.summarizeUrl(webUrl);
      if (res.success) {
        setWebSummary(res.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setWebLoading(false);
    }
  };

  const handleFetchLogs = async () => {
    try {
      const res = await api.getLogStreamAnalysis();
      if (res.success) {
        setLogLogs(res.logs || []);
        setLogScore(res.anomaly_score);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">AI Agent OS Suite</h3>
              <p className="text-[11px] text-neutral-500">Gemini 2.5 Flash • Zero-Disk In-RAM Co-Pilot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-neutral-100 text-neutral-500">
            <X size={16} />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex p-2 bg-neutral-100/60 border-b border-neutral-100 gap-1 text-xs overflow-x-auto no-scrollbar">
          {[
            { id: 'repl', label: 'Code REPL' },
            { id: 'git', label: 'Git Autopilot' },
            { id: 'query', label: 'Regex & SQL' },
            { id: 'meeting', label: 'Meeting Notes' },
            { id: 'summary', label: 'Web Summarizer' },
            { id: 'logs', label: 'Log Anomaly' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                if (t.id === 'git' && !gitMsg) handleFetchGitAutopilot();
                if (t.id === 'logs' && logLogs.length === 0) handleFetchLogs();
              }}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all ${
                activeTab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs">
          {activeTab === 'repl' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-1">
                  {(['python', 'bash', 'node'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setReplLang(lang)}
                      className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[10px] ${
                        replLang === lang ? 'bg-blue-600 text-white font-bold' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRunRepl}
                  disabled={replLoading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <Play size={12} /> {replLoading ? 'Executing...' : 'Run in RAM'}
                </button>
              </div>

              <textarea
                value={replCode}
                onChange={(e) => setReplCode(e.target.value)}
                className="w-full h-28 bg-neutral-900 text-emerald-400 font-mono text-xs p-3 rounded-2xl border border-neutral-800 focus:outline-none"
              />

              {replOutput && (
                <div className="bg-neutral-100 p-3 rounded-2xl border border-neutral-200 font-mono text-xs text-neutral-800 whitespace-pre-wrap">
                  {replOutput}
                </div>
              )}
            </div>
          )}

          {activeTab === 'git' && (
            <div className="space-y-3">
              <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                <div className="text-[10px] font-bold text-neutral-400 uppercase mb-1">Staged Git Diff</div>
                <div className="font-mono text-xs text-neutral-700">{gitStat || 'Inspecting repository...'}</div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Suggested Commit Message</label>
                <input
                  type="text"
                  value={gitMsg}
                  onChange={(e) => setGitMsg(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleFetchGitAutopilot}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-700 font-medium flex items-center gap-1"
                >
                  <RefreshCw size={14} className={gitLoading ? 'animate-spin' : ''} /> Re-Generate
                </button>
                <button
                  onClick={async () => {
                    await api.executeGitCommit(gitMsg);
                    alert('Commit executed successfully on main!');
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <GitCommit size={14} /> Commit to pearOS
                </button>
              </div>
            </div>
          )}

          {activeTab === 'query' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setQueryTarget('regex')}
                  className={`flex-1 py-1.5 rounded-xl font-medium ${queryTarget === 'regex' ? 'bg-purple-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  Regex Generator
                </button>
                <button
                  onClick={() => setQueryTarget('sql')}
                  className={`flex-1 py-1.5 rounded-xl font-medium ${queryTarget === 'sql' ? 'bg-purple-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}
                >
                  SQL Query
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. match email addresses or select active users"
                  value={queryPrompt}
                  onChange={(e) => setQueryPrompt(e.target.value)}
                  className="flex-1 p-2.5 bg-white border border-neutral-200 rounded-xl text-xs focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleRunQueryGen}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium shadow-sm active:scale-95"
                >
                  Generate
                </button>
              </div>

              {queryResult && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                  <span className="font-mono text-purple-900 font-semibold">{queryResult}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(queryResult);
                      alert('Copied to clipboard!');
                    }}
                    className="p-1.5 rounded-lg bg-white text-purple-700 shadow-sm"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'meeting' && (
            <div className="space-y-3">
              <button
                onClick={handleRunMeetingTranscribe}
                disabled={meetingLoading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium shadow-md flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Sparkles size={14} /> {meetingLoading ? 'Transcribing...' : 'Transcribe & Generate Action Items'}
              </button>

              {meetingSummary && (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">Executive Summary</div>
                    <div className="text-xs text-neutral-800 whitespace-pre-wrap mt-1">{meetingSummary}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">Action Items</div>
                    <ul className="list-disc list-inside text-xs text-neutral-700 mt-1 space-y-1">
                      {meetingActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  className="flex-1 p-2.5 bg-white border border-neutral-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
                <button
                  onClick={handleRunWebSummarize}
                  disabled={webLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm active:scale-95"
                >
                  Summarize
                </button>
              </div>

              {webSummary && (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-800 leading-relaxed">
                  {webSummary}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">Anomaly Risk Score: {logScore !== null ? `${logScore * 100}%` : '0%'}</span>
                <button
                  onClick={handleFetchLogs}
                  className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-medium flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                {logLogs.map((lg, i) => (
                  <div key={i} className="p-2 bg-neutral-900 text-neutral-300 rounded-xl border border-neutral-800 flex items-center gap-2">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${lg.level === 'INFO' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {lg.level}
                    </span>
                    <span className="truncate">{lg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
