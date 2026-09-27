import React, { useState } from 'react';
import {
  Terminal, ShieldCheck, Lock, User, Key, ArrowRight,
  RefreshCw, AlertCircle, Eye, EyeOff, Smartphone, Laptop
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { AppLogo } from '../components/common/AppLogo';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { addNotification, isApk } = useApp();
  const [username, setUsername] = useState<string>('ARYAN');
  const [password, setPassword] = useState<string>('Aryan@2007');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.login(username.trim(), password.trim());
      if (res.success) {
        localStorage.setItem('smart_remote_auth_user', res.username || 'ARYAN');
        localStorage.setItem('smart_remote_auth_token', res.token || 'authenticated');
        addNotification('Authentication Successful', `Welcome, ${res.username || 'ARYAN'}! Session established.`, 'success');
        onLoginSuccess();
      } else {
        setErrorMsg('Invalid username or password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-start sm:justify-center items-center p-4 pt-10 sm:pt-6 pb-8 bg-cyber-bg overflow-y-auto select-none font-sans">
      {/* Ambient background glow elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-cyber-surface border border-cyber-border rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 relative z-10 backdrop-blur-xl animate-in fade-in zoom-in-95 my-auto sm:my-0">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <AppLogo size={68} className="mb-2 inline-flex" />
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-slate-100 flex items-center justify-center gap-2">
            <span>SMART REMOTE</span>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono border border-cyan-500/30">
              KALI
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Secure Kali Linux Mobile &amp; Web Remote Controller
          </p>
        </div>

        {/* Android Native APK Download Card - Shown only for Web users */}
        {!isApk && (
          <div className="p-3.5 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-emerald-950/40 border border-cyan-500/50 rounded-2xl shadow-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Android App (.apk)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                      RECOMMENDED
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Full Phone Mic Intercom &amp; 60 FPS Stream</div>
                </div>
              </div>
            </div>
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-2 active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>DOWNLOAD ANDROID APK</span>
            </a>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Username
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Default: ARYAN</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ARYAN"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono uppercase"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Password
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Master Key</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                required
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-bold text-sm tracking-wide uppercase transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In To Workstation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Credentials Reminder Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Configured Access Keys:</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>
          <div className="flex justify-between font-mono text-[10px]">
            <span>Username: <strong className="text-cyan-400">ARYAN</strong></span>
            <span>Password: <strong className="text-cyan-400">Aryan@2007</strong></span>
          </div>
        </div>

        {/* Hardware & Network Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-4 font-mono">
          {!isApk ? (
            <a
              href="/SmartRemote.apk"
              download="SmartRemote.apk"
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-2"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Download .APK File</span>
            </a>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Native APK Mode</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-500">
            <Laptop className="w-3.5 h-3.5 text-emerald-400" />
            Tailscale 100.69.194.11
          </span>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
