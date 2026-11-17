import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Key,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Smartphone,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { addNotification, isApk, triggerHaptic } = useApp();
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

    triggerHaptic(40);
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.login(username.trim(), password.trim());
      if (res.success) {
        localStorage.setItem('smart_remote_auth_user', res.username || 'ARYAN');
        localStorage.setItem('smart_remote_auth_token', res.token || 'authenticated');
        addNotification('Authentication Successful', `Welcome, ${res.username || 'ARYAN'}! Session unlocked.`, 'success');
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
    <div className="fixed inset-0 z-50 flex flex-col justify-center items-center p-4 bg-[#F2F2F7] overflow-y-auto select-none font-sans">
      {/* Background soft ambient gradient blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-white/85 backdrop-blur-3xl border border-black/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative z-10 animate-in fade-in zoom-in-95">
        {/* Apple pearOS Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg text-2xl font-bold">
            
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              pearOS Smart Remote
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Apple Sequoia &amp; iOS 18 Light Edition
            </p>
          </div>
        </div>

        {/* Android Native APK Download Card for Web users */}
        {!isApk && (
          <a
            href="/app-debug.apk"
            download
            className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200 shadow-xs transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-900">Android APK Available</span>
                <span className="block text-[10px] text-slate-500">24/7 background GPS &amp; daemon</span>
              </div>
            </div>
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Download className="w-3.5 h-3.5" />
            </div>
          </a>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ARYAN"
                className="w-full bg-slate-100 focus:bg-white text-slate-900 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner font-medium"
              />
              <User className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pl-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-100 focus:bg-white text-slate-900 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-inner font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to pearOS</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <span className="text-[10px] font-mono text-slate-400">
            Encrypted Session • Cloudflare Workers Proxy
          </span>
        </div>
      </div>
    </div>
  );
};
