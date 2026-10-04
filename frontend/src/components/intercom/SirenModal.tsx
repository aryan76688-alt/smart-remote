import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Volume2, Mic, MicOff, Sparkles, X, AlertTriangle, Radio, Check } from 'lucide-react';
import { api } from '../../services/api';

interface SirenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SirenModal: React.FC<SirenModalProps> = ({ isOpen, onClose }) => {
  const [sirenActive, setSirenActive] = useState<boolean>(false);
  const [sirenLoading, setSirenLoading] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [talkStatus, setTalkStatus] = useState<string>('Hold to talk');
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.getSirenStatus().then(res => setSirenActive(res.active)).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSiren = async () => {
    setSirenLoading(true);
    try {
      const nextAction = sirenActive ? 'stop' : 'start';
      const res = await api.triggerSiren(nextAction, 30);
      setSirenActive(res.active);
    } catch (e) {
      console.error('Failed to trigger siren:', e);
    } finally {
      setSirenLoading(false);
    }
  };

  const startWalkieTalkie = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 100) {
          setTalkStatus('Broadcasting...');
          try {
            await api.sendIntercomAudio(blob);
            setTalkStatus('Played on Laptop!');
            setTimeout(() => setTalkStatus('Hold to talk'), 2000);
          } catch (e) {
            setTalkStatus('Failed to send');
            setTimeout(() => setTalkStatus('Hold to talk'), 2000);
          }
        } else {
          setTalkStatus('Hold to talk');
        }
      };

      recorder.start();
      setIsTalking(true);
      setTalkStatus('Speaking to Laptop...');
    } catch (e) {
      alert('Microphone permission required to talk to laptop speakers.');
      setIsTalking(false);
      setTalkStatus('Hold to talk');
    }
  };

  const stopWalkieTalkie = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsTalking(false);
  };

  const handleAiAnalyze = async () => {
    setAiAnalyzing(true);
    setAiSummary(null);
    try {
      const res = await api.aiAnalyzeCctv();
      setAiSummary(res.summary);
    } catch (e: any) {
      setAiSummary(`Error: ${e.message || 'AI analysis failed'}`);
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-md bg-slate-900 border rounded-2xl p-6 shadow-2xl transition-all ${
        sirenActive ? 'border-rose-500 shadow-rose-500/30 animate-pulse' : 'border-slate-800'
      }`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${sirenActive ? 'bg-rose-500 text-white animate-bounce' : 'bg-rose-500/10 text-rose-400'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Emergency Security Center</h2>
              <p className="text-xs text-slate-400">Remote siren, audio intercom, and Gemini AI guard</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 🚨 Emergency Siren Button */}
        <div className="mb-6 text-center">
          <button
            onClick={handleToggleSiren}
            disabled={sirenLoading}
            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition shadow-lg ${
              sirenActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-500/50 animate-pulse'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            <AlertTriangle className={`w-6 h-6 ${sirenActive ? 'animate-spin' : ''}`} />
            <span>{sirenActive ? 'STOP EMERGENCY SIREN' : '🚨 BLAST EMERGENCY SIREN (100% Volume)'}</span>
          </button>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {sirenActive ? 'Siren is blasting on Kali Linux laptop hardware speakers!' : 'Instantly unmutes and plays piercing dual-tone police alarm to scare intruders.'}
          </p>
        </div>

        {/* 🎙️ Walkie-Talkie Intercom */}
        <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-xl text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-3">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Two-Way Walkie-Talkie (Phone ➔ Laptop Speakers)</span>
          </div>

          <button
            onMouseDown={startWalkieTalkie}
            onMouseUp={stopWalkieTalkie}
            onTouchStart={startWalkieTalkie}
            onTouchEnd={stopWalkieTalkie}
            className={`w-20 h-20 mx-auto rounded-full flex flex-col items-center justify-center gap-1 transition shadow-lg select-none ${
              isTalking
                ? 'bg-cyan-500 text-slate-950 scale-105 ring-4 ring-cyan-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700'
            }`}
          >
            {isTalking ? <Mic className="w-8 h-8 animate-pulse" /> : <MicOff className="w-8 h-8" />}
          </button>

          <p className="text-xs font-medium text-slate-300 mt-3">{talkStatus}</p>
          <p className="text-[10px] text-slate-500">Hold button to speak, release to broadcast out of laptop</p>
        </div>

        {/* 🤖 Gemini AI Vision Security Guard */}
        <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Gemini AI Security Guard</span>
            </div>
            <button
              onClick={handleAiAnalyze}
              disabled={aiAnalyzing}
              className="text-[11px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-md transition"
            >
              {aiAnalyzing ? 'Analyzing...' : 'Analyze CCTV View'}
            </button>
          </div>

          {aiSummary ? (
            <p className="text-xs text-indigo-200 bg-indigo-950/60 p-2.5 rounded-lg border border-indigo-800/40">
              {aiSummary}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Tap 'Analyze CCTV View' to have Gemini Vision describe what the camera sees in natural human language.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
