import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { DeviceLayoutMode, AppNotification, SystemInfo } from '../types';
import { api } from '../services/api';

interface AppContextType {
  activeRoute: string;
  setActiveRoute: (route: string) => void;
  deviceMode: DeviceLayoutMode;
  setDeviceMode: (mode: DeviceLayoutMode) => void;
  theme: string;
  setTheme: (theme: string) => void;
  serverOnline: boolean;
  setServerOnline: (online: boolean) => void;
  tailscaleIp: string;
  systemInfo: SystemInfo | null;
  notifications: AppNotification[];
  addNotification: (title: string, message: string, level?: 'info' | 'warning' | 'error' | 'success') => void;
  clearNotifications: () => void;
  isFirstOpen: boolean;
  completeFirstOpenSetup: (mode: DeviceLayoutMode) => void;
  showFloatingDock: boolean;
  setShowFloatingDock: (show: boolean) => void;
  floatingAssistantOpen: boolean;
  setFloatingAssistantOpen: (open: boolean) => void;
  gdriveModalOpen: boolean;
  setGdriveModalOpen: (open: boolean) => void;
  immersiveMode: boolean;
  setImmersiveMode: (val: boolean) => void;
  isApk: boolean;
  triggerHaptic: (durationMs?: number) => void;
  openServerSettings: () => void;
  registerBackHandler: (handler: () => boolean) => () => void;
  enterPiP: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeRoute, setActiveRoute] = useState<string>('/dashboard');
  const [deviceMode, setDeviceModeState] = useState<DeviceLayoutMode>('mobile');

  const [theme, setThemeState] = useState<string>(() => {
    return localStorage.getItem('smart_remote_theme') || 'cyberpunk';
  });

  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [tailscaleIp, setTailscaleIp] = useState<string>('100.69.194.11');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'welcome',
      title: 'Smart Remote Connected',
      message: 'Secure Tailscale connection active. Ready for Kali Linux remote control.',
      level: 'success',
      timestamp: new Date(),
      read: false
    }
  ]);

  const [isFirstOpen, setIsFirstOpen] = useState<boolean>(false);

  const [showFloatingDock, setShowFloatingDock] = useState<boolean>(true);
  const [floatingAssistantOpen, setFloatingAssistantOpen] = useState<boolean>(false);
  const [gdriveModalOpen, setGdriveModalOpen] = useState<boolean>(false);
  const [immersiveMode, setImmersiveMode] = useState<boolean>(false);

  // Auto-detect native Android APK vs standard web browser
  const [isApk] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).AndroidBridge?.isApk?.() ||
      navigator.userAgent.includes('SmartRemoteMobileAndroid')
    );
  });

  const triggerHaptic = (durationMs: number = 40) => {
    try {
      if ((window as any).AndroidBridge?.vibrate) {
        (window as any).AndroidBridge.vibrate(durationMs);
        return;
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch {}
  };

  const openServerSettings = () => {
    if ((window as any).AndroidBridge?.openServerSettings) {
      (window as any).AndroidBridge.openServerSettings();
    } else {
      setActiveRoute('/settings');
    }
  };

  const enterPiP = () => {
    try {
      if ((window as any).AndroidBridge?.enterPiP) {
        (window as any).AndroidBridge.enterPiP();
        return;
      }
      // Web Fallback: Try PiP on any video element if available
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
        video.requestPictureInPicture().catch(() => {});
      }
    } catch {}
  };

  const applyThemeToDOM = (t: string) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
      document.body.setAttribute('data-theme', t);
      document.body.className = `theme-${t}`;
    }
  };

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('smart_remote_theme', newTheme);
    applyThemeToDOM(newTheme);
    api.updateSettings({ theme: newTheme }).catch(() => {});
  };

  const setDeviceMode = (_mode: DeviceLayoutMode) => {
    setDeviceModeState('mobile');
    localStorage.setItem('smart_remote_device_mode', 'mobile');
  };

  const completeFirstOpenSetup = (_mode: DeviceLayoutMode) => {
    setDeviceMode('mobile');
    localStorage.setItem('smart_remote_setup_done', 'true');
    setIsFirstOpen(false);
  };

  const addNotification = (title: string, message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    setNotifications(prev => [
      {
        id: Math.random().toString(36).substring(2, 9),
        title,
        message,
        level,
        timestamp: new Date(),
        read: false
      },
      ...prev.slice(0, 19)
    ]);
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Stack of back-press handlers for sheets, modals, and drawers
  const backHandlersRef = useRef<(() => boolean)[]>([]);

  const registerBackHandler = useCallback((handler: () => boolean) => {
    backHandlersRef.current.push(handler);
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter(h => h !== handler);
    };
  }, []);

  // Mobile Hardware / Gesture Back Navigation Listener
  useEffect(() => {
    (window as any).onAndroidBackPressed = () => {
      // 1. Check registered dismiss handlers (LIFO: topmost modal/sheet dismissed first)
      for (let i = backHandlersRef.current.length - 1; i >= 0; i--) {
        try {
          if (backHandlersRef.current[i]()) {
            return true;
          }
        } catch (e) {
          console.error('Back handler error:', e);
        }
      }

      // 2. Dismiss global AppContext modals
      if (floatingAssistantOpen) {
        setFloatingAssistantOpen(false);
        return true;
      }
      if (gdriveModalOpen) {
        setGdriveModalOpen(false);
        return true;
      }

      // 3. System Navigation: If not on dashboard, back returns to dashboard
      if (activeRoute !== '/dashboard') {
        setActiveRoute('/dashboard');
        return true;
      }

      // 4. At dashboard with no modals: return false so Android initiates double-tap exit
      return false;
    };
  }, [activeRoute, floatingAssistantOpen, gdriveModalOpen]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  useEffect(() => {
    api.getSystemInfo()
      .then(info => {
        setSystemInfo(info);
        if (info.tailscale_ip) {
          setTailscaleIp(info.tailscale_ip);
        }
        setServerOnline(true);
      })
      .catch(() => {
        setServerOnline(false);
      });

    api.getSettings()
      .then(settings => {
        if (settings && settings.theme && !localStorage.getItem('smart_remote_theme')) {
          setTheme(settings.theme);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppContext.Provider value={{
      activeRoute,
      setActiveRoute,
      deviceMode,
      setDeviceMode,
      theme,
      setTheme,
      serverOnline,
      setServerOnline,
      tailscaleIp,
      systemInfo,
      notifications,
      addNotification,
      clearNotifications,
      isFirstOpen,
      completeFirstOpenSetup,
      showFloatingDock,
      setShowFloatingDock,
      floatingAssistantOpen,
      setFloatingAssistantOpen,
      gdriveModalOpen,
      setGdriveModalOpen,
      immersiveMode,
      setImmersiveMode,
      isApk,
      triggerHaptic,
      openServerSettings,
      registerBackHandler,
      enterPiP,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
