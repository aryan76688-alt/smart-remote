import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  Maximize2,
  Wand2,
  Mic,
  MicOff,
  Sparkles,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export const TerminalView: React.FC = () => {
  const { triggerHaptic, addNotification } = useApp();

  const [command, setCommand] = useState<string>('');
  const [outputLines, setOutputLines] = useState<Array<{ command: string; output: string; exitCode: number }>>([
    {
      command: 'neofetch',
      output: `       .:'               aryan@pearOS-machine
      ::;                --------------------
     ::;                 OS: pearOS Workstation 2.0 x86_64
   :;::;::               Host: ThinkPad Workstation
  ::;::;::;              Kernel: 6.12.0-amd64
 :;::;::;::;             Uptime: 2 days, 4 hours
;::;::;::;::;            Shell: zsh 5.9
;::;::;::;::;            Resolution: 1920x1080
 ;::;::;::;:             DE: pearOS Light (macOS Sequoia Engine)
  ::;::;::;              WM: Mutter
   :;::;::               Terminal: web-terminal
     ::;                 CPU: AMD Ryzen / Intel Core i7
      ::;                Memory: 4120MiB / 15890MiB (25%)`,
      exitCode: 0
    }
  ]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // AI Fix Autopilot State (Feature 16)
  const [activeFix, setActiveFix] = useState<{
    command: string;
    explanation: string;
    suggested_command: string;
  } | null>(null);
  const [isFixing, setIsFixing] = useState<boolean>(false);

  // Voice-to-Code Dictation State (Feature 17)
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);
  const speechRecognitionRef = useRef<any>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // VOICE-TO-CODE DICTATION (Feature 17)
  // ──────────────────────────────────────────────────────────────────────────
  const handleToggleSpeech = () => {
    triggerHaptic(40);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      addNotification('Speech Error', 'Speech recognition not supported in this browser. Type command manually.', 'error');
      return;
    }

    if (isListeningSpeech) {
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      setIsListeningSpeech(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningSpeech(true);
        addNotification('Listening Voice...', 'Speak your command (e.g. "show disk usage" or "restart smart remote")', 'info');
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListeningSpeech(false);
        triggerHaptic(50);
        try {
          const res = await api.speechToCommand(transcript);
          if (res && res.command) {
            setCommand(res.command);
            addNotification('Voice to Code', `Converted "${transcript}" → $ ${res.command}`, 'success');
          } else {
            setCommand(transcript);
          }
        } catch {
          setCommand(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListeningSpeech(false);
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningSpeech(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // AI "FIX MY TERMINAL ERROR" AUTOPILOT (Feature 16)
  // ──────────────────────────────────────────────────────────────────────────
  const handleDiagnoseError = async (failedCmd: string, failedOutput: string, exitCode: number) => {
    triggerHaptic(40);
    setIsFixing(true);
    try {
      const res = await api.fixTerminalError(failedCmd, failedOutput, exitCode);
      if (res && res.success) {
        setActiveFix({
          command: failedCmd,
          explanation: res.explanation,
          suggested_command: res.suggested_command
        });
        addNotification('AI Fix Ready', res.explanation, 'info');
      }
    } catch {
      addNotification('AI Fix', 'Could not generate autopilot fix', 'error');
    } finally {
      setIsFixing(false);
    }
  };

  const handleApplyFix = (fixCmd: string) => {
    triggerHaptic(40);
    setActiveFix(null);
    setCommand(fixCmd);
    handleRunCommand(fixCmd);
  };

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = cmdToRun || command;
    if (!cmd.trim() || isRunning) return;

    setIsRunning(true);
    triggerHaptic(30);

    try {
      const res = await api.executeCommand(cmd);
      const out = res.stdout || res.stderr || '(command executed with no output)';
      const code = res.exit_code;

      setOutputLines((prev) => [
        ...prev,
        {
          command: cmd,
          output: out,
          exitCode: code
        }
      ]);

      // If command failed, automatically prompt with AI diagnosis option
      if (code !== 0) {
        handleDiagnoseError(cmd, out, code);
      } else {
        setActiveFix(null);
      }

      setCommand('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setOutputLines((prev) => [
        ...prev,
        {
          command: cmd,
          output: err.message || 'Execution error',
          exitCode: 1
        }
      ]);
      handleDiagnoseError(cmd, err.message || 'Execution error', 1);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyLast = () => {
    if (outputLines.length === 0) return;
    const last = outputLines[outputLines.length - 1];
    navigator.clipboard.writeText(last.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification('Terminal', 'Output copied to clipboard', 'info');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F2F7] overflow-hidden p-3 md:p-5">
      {/* Terminal Window Frame */}
      <div className="w-full flex-1 flex flex-col bg-[#1E1E24] text-[#E0E0E6] rounded-3xl shadow-xl overflow-hidden border border-black/10">
        {/* macOS Traffic Lights Window Header */}
        <div className="bg-[#2B2B36] px-4 py-3 flex items-center justify-between border-b border-black/20 select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            <span className="text-xs font-mono text-slate-400 ml-2">aryan@pearOS: ~ (zsh)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLast}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
              title="Copy last output"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setOutputLines([])}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
              title="Clear terminal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Command Action Chips */}
        <div className="bg-[#24242E] px-4 py-2 flex items-center gap-2 overflow-x-auto border-b border-black/10 no-scrollbar">
          {[
            'neofetch',
            'df -h /',
            'free -m',
            'uptime -p',
            'systemctl status smart-remote',
            'ip a'
          ].map((cmd) => (
            <button
              key={cmd}
              onClick={() => handleRunCommand(cmd)}
              className="whitespace-nowrap px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
            >
              $ {cmd}
            </button>
          ))}
        </div>

        {/* Terminal Output Log Area */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-4">
          {outputLines.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                <span>aryan@pearOS:~$</span>
                <span className="text-white">{item.command}</span>
                {item.exitCode !== 0 && (
                  <span className="ml-auto text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                    exit code {item.exitCode}
                  </span>
                )}
              </div>
              <pre className="text-slate-300 whitespace-pre-wrap pl-5 text-[11px] leading-relaxed">
                {item.output}
              </pre>
            </div>
          ))}

          {/* AI "Fix My Terminal Error" Autopilot Banner (Feature 16) */}
          {activeFix && (
            <div className="p-3 bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-500/30 rounded-2xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                  <Wand2 className="w-4 h-4 text-blue-400" />
                  <span>AI Terminal Error Autopilot</span>
                </div>
                <button
                  onClick={() => setActiveFix(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {activeFix.explanation}
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <code className="text-xs font-mono text-emerald-400 bg-black/40 px-2 py-1 rounded-lg truncate">
                  $ {activeFix.suggested_command}
                </code>
                <button
                  onClick={() => handleApplyFix(activeFix.suggested_command)}
                  className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-sans font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 shrink-0"
                >
                  <span>Apply & Run Fix</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-blue-400 pl-5 text-xs animate-pulse">
              <span>Running command on pearOS...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Bottom Interactive Command Line Bar with Speech-to-Code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunCommand();
          }}
          className="bg-[#2B2B36] p-2.5 flex items-center gap-2 border-t border-black/20"
        >
          <span className="text-emerald-400 font-mono font-bold pl-2 text-xs">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type zsh command or click mic to dictate..."
            className="flex-1 bg-transparent text-white font-mono text-xs outline-none placeholder:text-slate-500"
          />

          {/* Voice-to-Code Microphone Dictation Button (Feature 17) */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`p-2 rounded-xl transition-all active:scale-95 ${
              isListeningSpeech
                ? 'bg-rose-600 text-white shadow-md animate-pulse ring-4 ring-rose-400/40'
                : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'
            }`}
            title="Speak command in plain English"
          >
            {isListeningSpeech ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={!command.trim() || isRunning}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl text-xs font-mono font-semibold transition-all active:scale-95"
          >
            Run
          </button>
        </form>
      </div>
    </div>
  );
};
