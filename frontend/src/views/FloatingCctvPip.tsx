import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Volume2,
  VolumeX,
  Mic,
  Download,
  X,
  Maximize2,
  Radio,
  Move,
  Smartphone,
  Laptop
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface FloatingCctvPipProps {
  isOpen: boolean;
  onClose: () => void;
  onExpand: () => void;
}

export const FloatingCctvPip: React.FC<FloatingCctvPipProps> = ({ isOpen, onClose, onExpand }) => {
  const { triggerHaptic, addNotification } = useApp();

  const [cameraSource, setCameraSource] = useState<'laptop' | 'mobile'>('laptop');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isOpen) {
      if (cameraSource === 'mobile') {
        api.controlPhoneCamera('stop_camera').catch(() => {});
      }
      return;
    }

    if (cameraSource === 'mobile') {
      api.controlPhoneCamera('start_camera').catch(() => {});
    } else {
      api.controlPhoneCamera('stop_camera').catch(() => {});
    }

    return () => {
      if (cameraSource === 'mobile') {
        api.controlPhoneCamera('stop_camera').catch(() => {});
      }
    };
  }, [isOpen, cameraSource]);

  if (!isOpen) return null;

  const handleToggleAudio = () => {
    triggerHaptic(30);
    const next = !audioEnabled;
    setAudioEnabled(next);

    const targetAudio = cameraSource === 'mobile' ? '/api/camera/phone/audio-stream' : '/api/camera/laptop/audio';

    if (next) {
      if (!audioRef.current) {
        audioRef.current = new Audio(targetAudio);
      } else {
        audioRef.current.src = targetAudio;
      }
      audioRef.current.play().catch(() => {});
      addNotification('CCTV Audio', 'Listening to room audio', 'info');
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  };

  // Push-to-Talk Intercom to Laptop Speakers
  const handleStartTalking = async () => {
    try {
      triggerHaptic(40);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          await api.sendIntercomAudio(blob);
          addNotification('Intercom', 'Voice broadcast through pearOS laptop speakers', 'success');
        } catch {}
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsTalking(true);
    } catch {
      addNotification('Mic Error', 'Microphone access required for intercom', 'error');
    }
  };

  const handleStopTalking = () => {
    if (mediaRecorderRef.current && isTalking) {
      triggerHaptic(30);
      mediaRecorderRef.current.stop();
      setIsTalking(false);
    }
  };

  const handleSnapshot = async () => {
    setIsSnapshotting(true);
    triggerHaptic(30);
    try {
      const a = document.createElement('a');
      a.href = `/api/camera/laptop/stream?t=${Date.now()}`;
      a.download = `cctv_pip_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addNotification('Snapshot', 'Frame saved directly to device', 'success');
    } finally {
      setIsSnapshotting(false);
    }
  };

  return (
    <div className="fixed top-12 right-4 z-[1800] w-64 sm:w-72 bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden select-none animate-in fade-in zoom-in-95">
      {/* PiP Header Bar */}
      <div className="px-3 py-2 bg-white/10 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <button
            onClick={() => {
              triggerHaptic(20);
              setCameraSource(prev => prev === 'laptop' ? 'mobile' : 'laptop');
            }}
            className="text-[10px] font-bold font-mono text-emerald-300 hover:text-white flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 transition-all"
            title="Click to Switch Camera (Laptop / Mobile)"
          >
            {cameraSource === 'mobile' ? <Smartphone className="w-3 h-3 text-blue-400" /> : <Laptop className="w-3 h-3 text-emerald-400" />}
            <span>{cameraSource === 'mobile' ? 'OPPO PHONE' : 'LAPTOP'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onExpand}
            className="p-1 hover:bg-white/20 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Expand to Full View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-rose-500/30 text-slate-300 hover:text-rose-400 rounded-lg transition-colors"
            title="Close PiP"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Stream Viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <img
          src={cameraSource === 'mobile' ? '/api/camera/phone/stream' : '/api/camera/laptop/stream'}
          alt="pearOS Live Stream"
          className="w-full h-full object-cover"
        />

        {isTalking && (
          <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-bold animate-pulse">
            <Mic className="w-4 h-4 text-white" />
            <span>Broadcasting to Speakers...</span>
          </div>
        )}
      </div>

      {/* PiP Controls Bar */}
      <div className="p-2 bg-slate-900/95 flex items-center justify-between gap-1.5 border-t border-white/10">
        {/* Audio Toggle */}
        <button
          onClick={handleToggleAudio}
          className={`p-2 rounded-xl text-xs flex items-center justify-center transition-all ${
            audioEnabled
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white/10 text-slate-300 hover:bg-white/20'
          }`}
          title="Listen Room Audio"
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Walkie-Talkie Push-to-Talk Button */}
        <button
          onMouseDown={handleStartTalking}
          onMouseUp={handleStopTalking}
          onTouchStart={handleStartTalking}
          onTouchEnd={handleStopTalking}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all select-none ${
            isTalking
              ? 'bg-rose-600 text-white shadow-lg animate-pulse scale-95'
              : 'bg-white/10 hover:bg-white/20 text-slate-200'
          }`}
          title="Hold to Talk through Laptop Speakers"
        >
          <Mic className="w-3.5 h-3.5 text-blue-400" />
          <span>{isTalking ? 'TALKING LIVE' : 'Hold Walkie-Talkie'}</span>
        </button>

        {/* Snapshot Download Button */}
        <button
          onClick={handleSnapshot}
          disabled={isSnapshotting}
          className="p-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl transition-all"
          title="Snapshot to Device"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
