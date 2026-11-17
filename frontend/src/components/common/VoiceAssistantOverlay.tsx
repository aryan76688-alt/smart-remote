import React, { useState } from 'react';
import { Mic, MicOff, Send, X, AlertTriangle, Check, Volume2, Sparkles } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';

export const VoiceAssistantOverlay: React.FC = () => {
  const {
    voiceState, transcript, assistantReply, pendingConfirmation,
    startListening, stopListening, processTextInput,
    confirmPendingAction, cancelPendingAction
  } = useVoice();

  const [inputVal, setInputVal] = useState<string>('');
  const [minimized, setMinimized] = useState<boolean>(true);

  React.useEffect(() => {
    if (voiceState !== 'idle' || pendingConfirmation) {
      setMinimized(false);
    }
  }, [voiceState, pendingConfirmation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      processTextInput(inputVal.trim());
      setInputVal('');
    }
  };

  // If minimized or idle without pending confirmation, completely hide to prevent screen obstruction
  if ((minimized && voiceState === 'idle') || (!pendingConfirmation && voiceState === 'idle' && minimized)) {
    return null;
  }

  // Floating indicator & confirmation card
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-80 select-none">
      <div className="bg-cyber-surface/95 border border-cyan-500/50 rounded-2xl shadow-2xl backdrop-blur-xl p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Voice Assistant</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setMinimized(true)}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Minimize"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* State Indicator */}
        <div className="flex items-center space-x-3 py-1">
          <button
            onClick={voiceState === 'listening' ? stopListening : startListening}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              voiceState === 'listening'
                ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : voiceState === 'processing'
                ? 'bg-amber-500 text-slate-950 animate-spin'
                : voiceState === 'speaking'
                ? 'bg-cyan-500 text-slate-950 animate-bounce'
                : 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
            }`}
          >
            {voiceState === 'listening' ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 text-xs">
            <div className="font-semibold text-slate-200 uppercase text-[11px] tracking-wider">
              {voiceState === 'listening' && 'Listening...'}
              {voiceState === 'processing' && 'Processing...'}
              {voiceState === 'speaking' && 'Speaking response...'}
              {voiceState === 'idle' && 'Tap mic or type command'}
              {voiceState === 'error' && 'Retry command'}
            </div>
            {transcript && (
              <p className="text-slate-400 italic text-[11px] truncate mt-0.5">
                "{transcript}"
              </p>
            )}
          </div>
        </div>

        {/* Assistant Spoken / Written Reply */}
        {assistantReply && (
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-cyan-200">
            {assistantReply}
          </div>
        )}

        {/* Destructive Power Confirmation Card */}
        {pendingConfirmation && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-2.5 text-xs text-rose-200 animate-in fade-in">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Confirmation Required</span>
            </div>
            <p className="text-[11px] text-slate-300">{pendingConfirmation.prompt}</p>
            <div className="flex space-x-2 pt-1">
              <button
                onClick={confirmPendingAction}
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-xs flex items-center justify-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm</span>
              </button>
              <button
                onClick={cancelPendingAction}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Text input fallback form */}
        <form onSubmit={handleSubmit} className="flex items-center space-x-1.5">
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Type command / ask Kali..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
