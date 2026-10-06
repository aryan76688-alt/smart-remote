import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { VoiceProvider } from './context/VoiceContext';
import { CallProvider } from './context/CallContext';
import { VideoCallModal } from './components/call/VideoCallModal';
import { TopBar } from './components/common/TopBar';
import { BottomNav } from './components/common/BottomNav';
import { FloatingDock } from './components/common/FloatingDock';
import { VoiceAssistantOverlay } from './components/common/VoiceAssistantOverlay';
import { NotificationCenter } from './components/common/NotificationCenter';
import { GDriveConnectModal } from './components/sync/GDriveConnectModal';
import { api } from './services/api';
import { ShieldAlert, AlertTriangle, Lock, EyeOff } from 'lucide-react';

// 3-Page Flow Components
import { LoginPage } from './pages/LoginPage';
import { DeviceSelectPage } from './pages/DeviceSelectPage';

// Remote Pages
import { DashboardPage } from './pages/DashboardPage';
import { TerminalPage } from './pages/TerminalPage';
import { MirrorPage } from './pages/MirrorPage';
import { RemotePage } from './pages/RemotePage';
import { FilesPage } from './pages/FilesPage';
import { SystemPage } from './pages/SystemPage';
import { AssistantPage } from './pages/AssistantPage';
import { MediaPage } from './pages/MediaPage';
import { DevicesPage } from './pages/DevicesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { CctvPage } from './pages/CctvPage';
import { LaptopCallPage } from './pages/LaptopCallPage';
import { CallPage } from './pages/CallPage';
import { N8nPage } from './pages/N8nPage';
import { CyberPage } from './pages/CyberPage';
import { DevOpsPage } from './pages/DevOpsPage';

const AppContent: React.FC = () => {
  const {
    activeRoute,
    setActiveRoute,
    deviceMode,
    showFloatingDock,
    immersiveMode,
    triggerHaptic
  } = useApp();

  const isImmersive = immersiveMode && activeRoute === '/mirror';

  // Navigation flow between the 3 main pages:
  // 1: 'login' (Page 1)
  // 2: 'device_select' (Page 2)
  // 3: 'remote' (Page 3)
  const [appFlow, setAppFlow] = useState<'login' | 'device_select' | 'remote'>(() => {
    const hasUser = localStorage.getItem('smart_remote_auth_user');
    if (!hasUser) return 'login';
    return 'device_select';
  });

  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [tamperWarning, setTamperWarning] = useState<string | null>(null);
  const [stealthActive, setStealthActive] = useState<boolean>(false);

  // Anti-Tamper & Security Polling (Unplugged charger / Lid trigger)
  useEffect(() => {
    if (appFlow !== 'remote') return;
    let mounted = true;
    const checkTamper = async () => {
      try {
        const res = await api.getTamperStatus();
        if (mounted && res) {
          if (res.tampered) {
            setTamperWarning(res.alert || 'Warning: Laptop power disconnected or lid moved!');
          } else {
            setTamperWarning(null);
          }
        }
      } catch {
        // ignore
      }
    };
    checkTamper();
    const interval = setInterval(checkTamper, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [appFlow]);

  const handleLoginSuccess = () => {
    setAppFlow('device_select');
  };

  const handleDeviceSelected = (_device: any) => {
    setAppFlow('remote');
  };

  const handleSwitchDevice = () => {
    setAppFlow('device_select');
  };

  const handleLogout = () => {
    localStorage.removeItem('smart_remote_auth_user');
    localStorage.removeItem('smart_remote_auth_token');
    setAppFlow('login');
  };

  const handlePanicKillswitch = async () => {
    if (confirm('TRIGGER EMERGENCY PANIC? This will mute audio, blank display, and lock the Kali session.')) {
      try {
        triggerHaptic(100);
        await api.triggerPanic();
        alert('Panic executed: Screen locked, audio muted, host display blanked.');
      } catch (err: any) {
        alert(err.message || 'Panic trigger failed');
      }
    }
  };

  const handleToggleStealth = async () => {
    try {
      triggerHaptic(40);
      const next = !stealthActive;
      await api.toggleStealth(next);
      setStealthActive(next);
    } catch (err: any) {
      alert(err.message || 'Stealth toggle failed');
    }
  };

  // Direct Laptop Video Call Interface (Zero friction, instant connect)
  if (typeof window !== 'undefined' && (
    window.location.pathname.includes('/call-laptop') ||
    window.location.search.includes('call-laptop') ||
    (new URLSearchParams(window.location.search)).get('role') === 'laptop'
  )) {
    return <LaptopCallPage />;
  }

  // PAGE 1: Login Page with ARYAN / Aryan@2007
  if (appFlow === 'login') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // PAGE 2: Device Select Page (Kali Linux Workstation / Localhost)
  if (appFlow === 'device_select') {
    return (
      <DeviceSelectPage
        onDeviceSelected={handleDeviceSelected}
        onLogout={handleLogout}
      />
    );
  }

  // PAGE 3: Main Remote Controller
  const renderActivePage = () => {
    switch (activeRoute) {
      case '/cyber':
        return <CyberPage />;
      case '/devops':
        return <DevOpsPage />;
      case '/call':
        return <CallPage />;
      case '/cctv':
        return <CctvPage />;
      case '/n8n':
        return <N8nPage />;
      case '/terminal':
        return <TerminalPage />;
      case '/mirror':
        return <MirrorPage />;
      case '/remote':
        return <RemotePage />;
      case '/files':
        return <FilesPage />;
      case '/system':
        return <SystemPage />;
      case '/assistant':
        return <AssistantPage />;
      case '/media':
        return <MediaPage />;
      case '/devices':
        return <DevicesPage />;
      case '/history':
        return <HistoryPage />;
      case '/settings':
        return <SettingsPage />;
      case '/dashboard':
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-screen bg-cyber-bg text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Bar with right-side mic, unlock button, switch device button */}
      {!isImmersive && (
        <TopBar
          onOpenNotifications={() => setNotificationsOpen(true)}
          onSwitchDevice={handleSwitchDevice}
          onLogout={handleLogout}
        />
      )}

      {/* Anti-Tamper Security Warning Banner */}
      {tamperWarning && !isImmersive && (
        <div className="bg-rose-950/90 border-b border-rose-500/60 px-4 py-2 flex items-center justify-between text-xs text-rose-200 animate-pulse shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-mono font-bold">{tamperWarning}</span>
          </div>
          <button
            onClick={() => setTamperWarning(null)}
            className="text-[10px] text-rose-400 hover:text-white px-2 py-0.5 bg-rose-900 rounded font-mono"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Main Body Layout - 100% Mobile Optimized */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        {/* Center Active Workspace with smooth scroll and bottom-nav padding */}
        <main className={`flex-1 flex flex-col relative w-full ${isImmersive ? 'overflow-hidden p-0' : 'overflow-y-auto overflow-x-hidden pb-16'}`}>
          {renderActivePage()}
        </main>
      </div>

      {/* Emergency Panic Floating Killswitch (Bottom Right Above Nav) */}
      {!isImmersive && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2">
          {/* Ghost Screen Blackout Toggle */}
          <button
            onClick={handleToggleStealth}
            className={`p-3 rounded-full shadow-lg border backdrop-blur-md active:scale-95 transition-all ${
              stealthActive
                ? 'bg-purple-900 text-purple-300 border-purple-500 ring-2 ring-purple-400'
                : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Ghost Blackout Host Monitor"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          {/* Emergency Panic Button */}
          <button
            onClick={handlePanicKillswitch}
            className="p-3.5 rounded-full bg-rose-900/90 hover:bg-rose-800 text-rose-200 border border-rose-500 shadow-xl active:scale-95 transition-all flex items-center justify-center ring-2 ring-rose-500/30"
            title="EMERGENCY PANIC KILLSWITCH"
          >
            <Lock className="w-4 h-4 text-rose-300" />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar with safe area bottom spacing */}
      {!isImmersive && <BottomNav />}

      {/* Smart Control Floating Dock */}
      {showFloatingDock && !isImmersive && <FloatingDock />}

      {/* Voice Assistant Floating State & Spoken Overlay */}
      <VoiceAssistantOverlay />

      {/* Google Drive Cloud & CCTV Sync Modal */}
      <GDriveConnectModal />

      {/* Two-Way Video Calling (Mobile <-> Laptop) */}
      <VideoCallModal />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
};

import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <WebSocketProvider>
          <VoiceProvider>
            <CallProvider>
              <AppContent />
            </CallProvider>
          </VoiceProvider>
        </WebSocketProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
