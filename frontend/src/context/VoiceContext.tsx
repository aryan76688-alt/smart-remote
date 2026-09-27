import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import { useApp } from './AppContext';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceContextType {
  voiceState: VoiceState;
  transcript: string;
  assistantReply: string;
  pendingConfirmation: { prompt: string; command: string } | null;
  autoContinuousListening: boolean;
  setAutoContinuousListening: (enabled: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  processTextInput: (text: string) => Promise<void>;
  confirmPendingAction: () => Promise<void>;
  cancelPendingAction: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { setActiveRoute, addNotification } = useApp();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantReply, setAssistantReply] = useState<string>('');
  const [pendingConfirmation, setPendingConfirmation] = useState<{ prompt: string; command: string } | null>(null);
  const [autoContinuousListening, setAutoContinuousListening] = useState<boolean>(() => {
    return localStorage.getItem('smart_remote_auto_voice') === 'true';
  });

  const recognitionRef = useRef<any>(null);
  const isContinuousRef = useRef<boolean>(autoContinuousListening);

  useEffect(() => {
    isContinuousRef.current = autoContinuousListening;
    localStorage.setItem('smart_remote_auto_voice', autoContinuousListening ? 'true' : 'false');
  }, [autoContinuousListening]);

  // Cleanse speech text for audio output (strictly follows OpenAI Realtime spoken output rules)
  const phoneticCleanseForSpeech = (text: string): string => {
    let clean = text.replace(/<[^>]*>/g, '');
    clean = clean.replace(/[`*#_~]/g, '');
    clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    clean = clean.replace(/(\d+)\s*%/g, '$1 percent');
    clean = clean.replace(/(\d+(\.\d+)?)\s*GB/gi, '$1 gigabytes');
    clean = clean.replace(/(\d+(\.\d+)?)\s*MB/gi, '$1 megabytes');
    clean = clean.replace(/(\d+(\.\d+)?)\s*KB/gi, '$1 kilobytes');
    clean = clean.replace(/\bCPU\b/g, 'C P U');
    clean = clean.replace(/\bRAM\b/g, 'ram');
    clean = clean.replace(/\bIP\b/g, 'I P');
    clean = clean.replace(/\bkbps\b/gi, 'kilobits per second');
    return clean.trim();
  };

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const spokenText = phoneticCleanseForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setVoiceState('speaking');
      utterance.onend = () => {
        setVoiceState('idle');
        // If continuous mode is enabled, immediately resume listening!
        if (isContinuousRef.current) {
          setTimeout(startListening, 300);
        }
      };
      utterance.onerror = () => {
        setVoiceState('idle');
        if (isContinuousRef.current) setTimeout(startListening, 500);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setVoiceState('idle');
    }
  };

  const processTranscript = async (text: string) => {
    if (!text.trim()) {
      setVoiceState('idle');
      return;
    }

    setVoiceState('processing');
    setTranscript(text);

    try {
      if (navigator.vibrate) navigator.vibrate(30);

      const res = await api.processVoice(text);
      setAssistantReply(res.spoken_reply);

      if (res.requires_confirmation && res.pending_command) {
        setPendingConfirmation({
          prompt: res.spoken_reply,
          command: res.pending_command
        });
        speak(res.spoken_reply);
        return;
      }

      // Handle navigation
      if (res.action_executed?.startsWith('navigate:')) {
        const route = res.action_executed.replace('navigate:', '');
        setActiveRoute(route);
      }

      // Handle voice search
      if (res.action_executed?.startsWith('search:files:')) {
        setActiveRoute('/files');
      }

      addNotification('Voice Command', `${text} -> ${res.spoken_reply}`, 'info');
      speak(res.spoken_reply);
    } catch {
      setVoiceState('error');
      setAssistantReply('Could not execute voice command.');
      speak('Sorry, could not process command.');
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('error');
      setAssistantReply('Speech recognition not supported on this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceState('listening');
        setTranscript('');
        setAssistantReply('');
        if (navigator.vibrate) navigator.vibrate(20);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        processTranscript(text);
      };

      recognition.onerror = (evt: any) => {
        if (evt.error === 'no-speech' && isContinuousRef.current) {
          // Restart immediately in continuous mode
          setTimeout(startListening, 200);
          return;
        }
        setVoiceState('idle');
      };

      recognition.onend = () => {
        if (voiceState === 'listening') {
          if (isContinuousRef.current) {
            setTimeout(startListening, 250);
          } else {
            setVoiceState('idle');
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
  };

  const processTextInput = async (text: string) => {
    await processTranscript(text);
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;
    const cmd = pendingConfirmation.command;
    setPendingConfirmation(null);
    setVoiceState('processing');

    try {
      const res = await api.executeCommand(cmd, true);
      const reply = res.exit_code === 0 ? 'Action executed.' : 'Action failed.';
      setAssistantReply(reply);
      speak(reply);
      addNotification('Confirmed Action', reply, res.exit_code === 0 ? 'success' : 'error');
    } catch {
      speak('Execution failed.');
      setVoiceState('idle');
    }
  };

  const cancelPendingAction = () => {
    setPendingConfirmation(null);
    setAssistantReply('Action cancelled.');
    speak('Action cancelled.');
    setVoiceState('idle');
  };

  return (
    <VoiceContext.Provider value={{
      voiceState,
      transcript,
      assistantReply,
      pendingConfirmation,
      autoContinuousListening,
      setAutoContinuousListening,
      startListening,
      stopListening,
      processTextInput,
      confirmPendingAction,
      cancelPendingAction,
    }}>
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within VoiceProvider');
  return context;
};
