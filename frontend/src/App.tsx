import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { VoiceProvider } from './context/VoiceContext';
import { CallProvider } from './context/CallContext';
import { VideoCallModal } from './components/call/VideoCallModal';
import { VoiceAssistantOverlay } from './components/common/VoiceAssistantOverlay';
import { NotificationCenter } from './components/common/NotificationCenter';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { DeviceSelectPage } from './pages/DeviceSelectPage';
import { MainWorkspace } from './views/MainWorkspace';
import { api } from './services/api';
import { AlertTriangle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { addNotification } = useApp();

  // Navigation flow between the 3 main stages:
  // 1: 'login' (Page 1)
  // 2: 'device_select' (Page 2)
  // 3: 'remote' (Page 3 - MainWorkspace)
  const [appFlow, setAppFlow] = useState<'login' | 'device_select' | 'remote'>(() => {
    const hasUser = localStorage.getItem('smart_remote_auth_user');
    if (!hasUser) return 'login';
    return 'device_select';
  });

  const [tamperWarning, setTamperWarning] = useState<string | null>(null);

  // Anti-Tamper & Security Watcher
  useEffect(() => {
    if (appFlow !== 'remote') return;
    let mounted = true;
    const checkTamper = async () => {
      try {
        const res = await api.getTamperStatus();
        if (mounted && res) {
          if (res.tampered) {
            setTamperWarning(res.alert || 'Security Notice: Laptop power disconnected or lid moved!');
          } else {
            setTamperWarning(null);
          }
        }
      } catch {}
    };
    checkTamper();
    const interval = setInterval(checkTamper, 12000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [appFlow]);

  // Page 1: Sign in
  if (appFlow === 'login') {
    return <LoginPage onLoginSuccess={() => setAppFlow('device_select')} />;
  }

  // Page 2: Select Node
  if (appFlow === 'device_select') {
    return (
      <DeviceSelectPage
        onDeviceSelected={() => setAppFlow('remote')}
        onLogout={() => {
          localStorage.removeItem('smart_remote_auth_user');
          localStorage.removeItem('smart_remote_auth_token');
          setAppFlow('login');
        }}
      />
    );
  }

  // Page 3: Brand New Apple macOS Sequoia & iOS 18 Light UI
  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#F2F2F7] select-none font-sans">
      {/* Tamper Alert Bar */}
      {tamperWarning && (
        <div className="absolute top-8 inset-x-0 z-[1600] bg-rose-600 text-white px-4 py-1.5 flex items-center justify-between text-xs shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{tamperWarning}</span>
          </div>
          <button
            onClick={() => setTamperWarning(null)}
            className="text-[10px] bg-rose-800 hover:bg-rose-900 px-2 py-0.5 rounded font-mono"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Main macOS Sequoia Light Workspace */}
      <MainWorkspace />

      {/* Persistent Background Voice AI Assistant Floating Overlay */}
      <VoiceAssistantOverlay />

      {/* Persistent Two-Way Video Call Modal */}
      <VideoCallModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <OfflineQueueProvider>
          <WebSocketProvider>
            <VoiceProvider>
              <CallProvider>
                <AppContent />
              </CallProvider>
            </VoiceProvider>
          </WebSocketProvider>
        </OfflineQueueProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
