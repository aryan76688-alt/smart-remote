import React, { useState } from 'react';
import { MenuBar } from './MenuBar';
import { Dock, DockTabId } from './Dock';
import { ControlCenterModal } from './ControlCenterModal';
import { GoogleMapView } from './GoogleMapView';
import { AgentOSView } from './AgentOSView';
import { CctvLiveView } from './CctvLiveView';
import { FinderView } from './FinderView';
import { RemoteTrackpadView } from './RemoteTrackpadView';
import { TerminalView } from './TerminalView';
import { SettingsView } from './SettingsView';
import { FloatingCctvPip } from './FloatingCctvPip';
import { PearDropModal } from './PearDropModal';
import { UniversalClipboardBar } from './UniversalClipboardBar';
import { DynamicIsland } from './DynamicIsland';
import { AudioMasterModal } from './AudioMasterModal';
import { TeleprompterModal } from './TeleprompterModal';
import { DrawingTabletModal } from './DrawingTabletModal';
import { GamepadModal } from './GamepadModal';
import { TacticalDefenseModal } from './TacticalDefenseModal';
import { AiCopilotModal } from './AiCopilotModal';
import { Camera, Smartphone, Laptop, X, ShieldCheck } from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

export const MainWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DockTabId>('maps');
  const [controlCenterOpen, setControlCenterOpen] = useState<boolean>(false);
  const [dynamicIslandModalOpen, setDynamicIslandModalOpen] = useState<boolean>(false);
  const [pipOpen, setPipOpen] = useState<boolean>(false);
  const [pearDropOpen, setPearDropOpen] = useState<boolean>(false);
  const [clipboardOpen, setClipboardOpen] = useState<boolean>(false);

  // Tactical Pro Suite Modal States (Features 1-50)
  const [audioMasterOpen, setAudioMasterOpen] = useState<boolean>(false);
  const [teleprompterOpen, setTeleprompterOpen] = useState<boolean>(false);
  const [drawingTabletOpen, setDrawingTabletOpen] = useState<boolean>(false);
  const [gamepadOpen, setGamepadOpen] = useState<boolean>(false);
  const [tacticalDefenseOpen, setTacticalDefenseOpen] = useState<boolean>(false);
  const [aiCopilotOpen, setAiCopilotOpen] = useState<boolean>(false);

  const { startListening, stopListening, voiceState } = useVoice();

  // Tab Titles
  const getTabTitle = (tab: DockTabId): string => {
    switch (tab) {
      case 'maps':
        return 'Google Maps Live Fleet';
      case 'agents':
        return 'Nova Prime AgentOS';
      case 'cctv':
        return 'Live CCTV (Zero Storage)';
      case 'files':
        return 'Finder (Files & Progress)';
      case 'remote':
        return 'Apple Magic Remote';
      case 'terminal':
        return 'pearOS Terminal';
      case 'settings':
        return 'Settings & Background Daemons';
    }
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'maps':
        return <GoogleMapView />;
      case 'agents':
        return <AgentOSView />;
      case 'cctv':
        return <CctvLiveView onTogglePip={() => setPipOpen((prev) => !prev)} />;
      case 'files':
        return <FinderView />;
      case 'remote':
        return <RemoteTrackpadView />;
      case 'terminal':
        return <TerminalView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <GoogleMapView />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-screen bg-[#F2F2F7] text-[#1C1C1E] overflow-hidden select-none font-sans relative">
      {/* iOS 18 Dynamic Island Pill (Feature 1) */}
      <DynamicIsland onOpenControlCenter={() => setControlCenterOpen(true)} />

      {/* Top macOS Menu Bar */}
      <MenuBar
        activeModuleTitle={getTabTitle(activeTab)}
        onOpenControlCenter={() => setControlCenterOpen(true)}
        onOpenDynamicIsland={() => setDynamicIslandModalOpen(true)}
        onTriggerSiri={() => {
          if (voiceState === 'listening') stopListening();
          else startListening();
        }}
        onOpenPearDrop={() => setPearDropOpen(true)}
        onOpenClipboard={() => setClipboardOpen(true)}
        onTogglePip={() => setPipOpen((prev) => !prev)}
      />

      {/* Main Viewport */}
      <main className="flex-1 w-full h-[calc(100dvh-2rem)] overflow-hidden relative pb-16">
        {renderActiveView()}
      </main>

      {/* macOS Bottom Floating Dock */}
      <Dock activeTab={activeTab} onSelectTab={(tab) => setActiveTab(tab)} />

      {/* Control Center Drawer Popover */}
      <ControlCenterModal
        isOpen={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
        onOpenPearDrop={() => setPearDropOpen(true)}
        onOpenClipboard={() => setClipboardOpen(true)}
        onOpenAudioMaster={() => setAudioMasterOpen(true)}
        onOpenTeleprompter={() => setTeleprompterOpen(true)}
        onOpenDrawingTablet={() => setDrawingTabletOpen(true)}
        onOpenGamepad={() => setGamepadOpen(true)}
        onOpenTacticalDefense={() => setTacticalDefenseOpen(true)}
        onOpenAiCopilot={() => setAiCopilotOpen(true)}
      />

      {/* Tactical 50-Feature Suite Modals */}
      <AudioMasterModal 
        isOpen={audioMasterOpen} 
        onClose={() => setAudioMasterOpen(false)} 
      />

      <TeleprompterModal 
        isOpen={teleprompterOpen} 
        onClose={() => setTeleprompterOpen(false)} 
      />

      <DrawingTabletModal 
        isOpen={drawingTabletOpen} 
        onClose={() => setDrawingTabletOpen(false)} 
      />

      <GamepadModal 
        isOpen={gamepadOpen} 
        onClose={() => setGamepadOpen(false)} 
      />

      <TacticalDefenseModal 
        isOpen={tacticalDefenseOpen} 
        onClose={() => setTacticalDefenseOpen(false)} 
      />

      <AiCopilotModal 
        isOpen={aiCopilotOpen} 
        onClose={() => setAiCopilotOpen(false)} 
      />

      {/* Floating CCTV PiP Mini Player */}
      <FloatingCctvPip
        isOpen={pipOpen}
        onClose={() => setPipOpen(false)}
        onExpand={() => {
          setPipOpen(false);
          setActiveTab('cctv');
        }}
      />

      {/* pearDrop Fast Share Modal */}
      <PearDropModal
        isOpen={pearDropOpen}
        onClose={() => setPearDropOpen(false)}
      />

      {/* Universal Clipboard Manager Drawer */}
      <UniversalClipboardBar
        isOpen={clipboardOpen}
        onClose={() => setClipboardOpen(false)}
      />

      {/* Dynamic Island Expanded Status Modal */}
      {dynamicIslandModalOpen && (
        <div
          onClick={() => setDynamicIslandModalOpen(false)}
          className="fixed inset-0 z-[2000] flex items-start justify-center pt-12 bg-black/10 backdrop-blur-xs select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-96 bg-black/90 backdrop-blur-3xl text-white border border-white/20 shadow-2xl rounded-3xl p-4 space-y-3 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold font-mono text-emerald-400">Dynamic Island Active</span>
              </div>
              <button
                onClick={() => setDynamicIslandModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-mono">Live CCTV</span>
                </div>
                <p className="font-bold text-white">Streaming Live</p>
                <p className="text-[10px] text-slate-400">0 Disk Space Used</p>
              </div>

              <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-mono">Oppo Node</span>
                </div>
                <p className="font-bold text-white">Battery 88%</p>
                <p className="text-[10px] text-slate-400">GPS Fleet Locked</p>
              </div>
            </div>

            <div className="p-2.5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>Security Sensor:</span>
              <span className="text-emerald-400 font-bold">Lid Inhibited & Armed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
