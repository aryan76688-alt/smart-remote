import React, { useState } from 'react';
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

const AppContent: React.FC = () => {
  const {
    activeRoute,
    setActiveRoute,
    deviceMode,
    showFloatingDock,
    immersiveMode
  } = useApp();

  const isImmersive = immersiveMode && activeRoute === '/mirror';

  // Navigation flow between the 3 main pages:
  // 1: 'login' (Page 1)
  // 2: 'device_select' (Page 2)
  // 3: 'remote' (Page 3)
  const [appFlow, setAppFlow] = useState<'login' | 'device_select' | 'remote'>(() => {
    const hasUser = localStorage.getItem('smart_remote_auth_user');
    if (!hasUser) return 'login';
    // If user is already authenticated, start on device select page as requested
    return 'device_select';
  });

  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

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

      {/* Main Body Layout - 100% Mobile Optimized */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        {/* Center Active Workspace with smooth scroll and bottom-nav padding */}
        <main className={`flex-1 flex flex-col relative w-full ${isImmersive ? 'overflow-hidden p-0' : 'overflow-y-auto overflow-x-hidden pb-16'}`}>
          {renderActivePage()}
        </main>
      </div>

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
