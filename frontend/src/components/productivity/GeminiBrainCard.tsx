import React, { useState, useEffect } from 'react';
import { Sparkles, Key, CheckCircle2, AlertCircle, Bot, Mic, Send } from 'lucide-react';
import { api } from '../../services/api';

export const GeminiBrainCard: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [status, setStatus] = useState<{ configured: boolean; masked_key: string | null }>({ configured: false, masked_key: null });
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Jarvis assistant testing
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [jarvisReply, setJarvisReply] = useState<string | null>(null);
  const [suggestedCmd, setSuggestedCmd] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await api.getGeminiStatus();
      setStatus(res);
    } catch (e) {
      console.error('Failed to get Gemini status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await api.setGeminiKey(apiKey);
      if (res.success) {
        setSaveSuccess(true);
        setApiKey('');
        fetchStatus();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save Gemini key:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleAskJarvis = async () => {
    if (!chatPrompt.trim()) return;
    setChatLoading(true);
    setJarvisReply(null);
    setSuggestedCmd(null);
    try {
      const res = await api.askJarvis(chatPrompt);
      setJarvisReply(res.reply);
      setSuggestedCmd(res.command);
    } catch (e: any) {
      setJarvisReply(`Error: ${e.message || 'Failed to talk to Gemini'}`);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Gemini AI Brain</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                status.configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
              }`}>
                {status.configured ? 'Active' : 'Key Needed'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Powers Vision Security Guard & Jarvis Voice Assistant</p>
          </div>
        </div>
      </div>

      {/* API Key Input */}
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
          {status.configured ? `Configured Key: (${status.masked_key})` : 'Paste your Gemini API Key:'}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={status.configured ? 'Paste new key to update...' : 'AIzaSy...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleSaveKey}
            disabled={saving || !apiKey.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {saveSuccess && (
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Key saved successfully! AI Brain is active.
          </p>
        )}
      </div>

      {/* Jarvis Voice & Chat Sandbox */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2 text-xs text-slate-300 font-medium">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Ask Jarvis AI (Voice / Text):</span>
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            placeholder="e.g. 'Check my CPU', 'Lock laptop', 'How much RAM is free?'"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAskJarvis()}
          />
          <button
            onClick={handleAskJarvis}
            disabled={chatLoading || !chatPrompt.trim()}
            className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 p-2 rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {chatLoading && (
          <p className="text-xs text-indigo-400 italic animate-pulse">Jarvis is thinking...</p>
        )}

        {jarvisReply && (
          <div className="mt-2 p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
            <p className="text-slate-200">{jarvisReply}</p>
            {suggestedCmd && (
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-1">Recommended Command:</span>
                <code className="bg-slate-950 px-2 py-1 rounded text-cyan-400 font-mono text-[11px] block">
                  {suggestedCmd}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
