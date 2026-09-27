import React, { useState } from 'react';
import { Smartphone, Monitor, Tablet, CheckCircle2, Wifi, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DeviceLayoutMode } from '../../types';
import { api } from '../../services/api';

export const SetupWizardModal: React.FC = () => {
  const { isFirstOpen, completeFirstOpenSetup, tailscaleIp, serverOnline } = useApp();
  const [step, setStep] = useState<number>(1);
  const [selectedMode, setSelectedMode] = useState<DeviceLayoutMode>('mobile');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  if (!isFirstOpen) return null;

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.pingDevice();
      setTestResult(`Online (${res.status}) • Tailscale ${res.tailscale}`);
    } catch {
      setTestResult('Connection failed to backend');
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = () => {
    completeFirstOpenSetup(selectedMode);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-cyber-surface border border-cyan-500/50 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl text-slate-100 animate-in zoom-in-95">
        {step === 1 ? (
          <>
            {/* Step 1: Welcome & Connection Validation */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-mono font-bold text-xl flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
                &gt;_
              </div>
              <h1 className="text-xl font-bold tracking-wider uppercase text-slate-100">
                SMART REMOTE
              </h1>
              <p className="text-xs text-cyan-300">
                “Control your Linux machine anywhere on your private network.”
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Server Status</span>
                <span className="flex items-center space-x-1 font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{serverOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Tailscale Connection</span>
                <span className="flex items-center space-x-1 font-mono text-cyan-400">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{tailscaleIp}</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Connection URL</span>
                <span className="font-mono text-slate-200">http://{tailscaleIp}:7070</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Target Workstation</span>
                <span className="font-mono text-slate-200">Kali Linux Rolling</span>
              </div>
            </div>

            {testResult && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={testConnection}
                disabled={testing}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-cyan-500/20"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Device-Type Selection */}
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold tracking-wider uppercase text-cyan-400">
                HOW ARE YOU USING SMART REMOTE?
              </h2>
              <p className="text-xs text-slate-400">
                Choose your preferred interface. You can adjust this anytime in Settings.
              </p>
            </div>

            <div className="space-y-3">
              {/* Mobile */}
              <div
                onClick={() => setSelectedMode('mobile')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedMode === 'mobile'
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">📱 MOBILE</div>
                    <div className="text-xs text-slate-400">Optimized for touch and one-hand thumb use</div>
                  </div>
                </div>
              </div>

              {/* Desktop */}
              <div
                onClick={() => setSelectedMode('desktop')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedMode === 'desktop'
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">💻 DESKTOP</div>
                    <div className="text-xs text-slate-400">Optimized for mouse/keyboard workstation and large screens</div>
                  </div>
                </div>
              </div>

              {/* Tablet */}
              <div
                onClick={() => setSelectedMode('tablet')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedMode === 'tablet'
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                    <Tablet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-100">📲 TABLET</div>
                    <div className="text-xs text-slate-400">Hybrid adaptive touch + split-view desktop layout</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-cyan-500/20"
              >
                <span>Launch Smart Remote</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
