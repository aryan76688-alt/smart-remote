import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, Shield, ShieldAlert, Zap, Skull, Trash2, Eye, EyeOff, Radio, 
  Smartphone, Lock, AlertTriangle, CheckCircle2, Siren, Bug
} from 'lucide-react';

interface TacticalDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TacticalDefenseModal: React.FC<TacticalDefenseModalProps> = ({ isOpen, onClose }) => {
  const [tamperArmed, setTamperArmed] = useState(false);
  const [honeypotArmed, setHoneypotArmed] = useState(true);
  const [tripwireArmed, setTripwireArmed] = useState(false);
  const [shoulderSurferAlert, setShoulderSurferAlert] = useState(false);
  const [rfBands, setRfBands] = useState<any[]>([]);
  const [wipeNotice, setWipeNotice] = useState(false);
  const [decoyActive, setDecoyActive] = useState(false);
  const [kernelPanicActive, setKernelPanicActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getTripwireStatus().then(res => {
        if (res.success && res.tripwire) setTripwireArmed(res.tripwire.armed);
      }).catch(() => null);

      api.getShoulderSurferStatus().then(res => {
        if (res.success) setShoulderSurferAlert(res.alert);
      }).catch(() => null);

      api.getAcousticSpectrum().then(res => {
        if (res.success) setRfBands(res.bands || []);
      }).catch(() => null);

      api.getMovementTamperStatus().then(res => {
        if (res.success) setTamperArmed(res.tamper_state.armed);
      }).catch(() => null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTripwireToggle = async () => {
    const next = !tripwireArmed;
    setTripwireArmed(next);
    await api.configureTripwire(next);
  };

  const handleTamperToggle = async () => {
    const next = !tamperArmed;
    setTamperArmed(next);
    await api.configureTamperAlarm(next);
  };

  const handleHoneypotToggle = async () => {
    const next = !honeypotArmed;
    setHoneypotArmed(next);
    await api.configureClipboardHoneypot(next);
  };

  const handleSilentWipe = async () => {
    if (confirm('Execute Emergency Silent Wipe? Clears clipboard history, purges RAM buffers, and drops OS pagecaches.')) {
      await api.emergencySilentWipe();
      setWipeNotice(true);
      setTimeout(() => setWipeNotice(false), 2000);
    }
  };

  const handleBeacon = async () => {
    if ('vibrate' in navigator) navigator.vibrate(20);
    await api.emitUltrasonicBeacon(19500, 300);
    alert('Inaudible 19.5kHz Ultrasonic Proximity Beacon broadcast.');
  };

  const handleKernelPanic = async () => {
    const next = !kernelPanicActive;
    setKernelPanicActive(next);
    await api.toggleKernelPanicDecoy(next);
  };

  const handleDecoyDesktop = async () => {
    const next = !decoyActive;
    setDecoyActive(next);
    await api.toggleDecoyDesktop(next);
  };

  const handleFlipLock = async () => {
    await api.triggerFlipLock();
    alert('pearOS Screen Locked and Master Audio Muted.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">Tactical Stealth & Defense</h3>
              <p className="text-[11px] text-neutral-500">Zero-Disk RAM Security Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-neutral-100 text-neutral-500">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto no-scrollbar space-y-4 text-xs">
          {/* Quick Alarm / Notice Banner */}
          {shoulderSurferAlert && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl flex items-center gap-2 animate-bounce">
              <EyeOff size={16} />
              <span>Anti-Shoulder Surfer: Multiple faces detected behind keyboard! Privacy Blinder active.</span>
            </div>
          )}

          {wipeNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-2xl flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>In-memory buffers, clipboard history & caches successfully purged. Zero traces remain.</span>
            </div>
          )}

          {/* Defense Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Tripwire */}
            <button
              onClick={handleTripwireToggle}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all ${
                tripwireArmed ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <Zap size={18} className={tripwireArmed ? 'text-white' : 'text-red-500'} />
                <span className="text-[10px] font-bold uppercase">{tripwireArmed ? 'ARMED' : 'OFF'}</span>
              </div>
              <div>
                <div className="font-bold">Virtual Tripwire</div>
                <div className={`text-[10px] ${tripwireArmed ? 'text-white/80' : 'text-neutral-400'}`}>Optical CCTV Line</div>
              </div>
            </button>

            {/* Tamper Alarm */}
            <button
              onClick={handleTamperToggle}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all ${
                tamperArmed ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <Siren size={18} className={tamperArmed ? 'text-white' : 'text-amber-500'} />
                <span className="text-[10px] font-bold uppercase">{tamperArmed ? 'ARMED' : 'OFF'}</span>
              </div>
              <div>
                <div className="font-bold">Movement Alarm</div>
                <div className={`text-[10px] ${tamperArmed ? 'text-white/80' : 'text-neutral-400'}`}>Inertial Laptop Leash</div>
              </div>
            </button>

            {/* Clipboard Honeypot */}
            <button
              onClick={handleHoneypotToggle}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all ${
                honeypotArmed ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <Bug size={18} className={honeypotArmed ? 'text-white' : 'text-blue-500'} />
                <span className="text-[10px] font-bold uppercase">{honeypotArmed ? 'ACTIVE' : 'OFF'}</span>
              </div>
              <div>
                <div className="font-bold">Clipboard Honeypot</div>
                <div className={`text-[10px] ${honeypotArmed ? 'text-white/80' : 'text-neutral-400'}`}>Anti-Spyware Shield</div>
              </div>
            </button>

            {/* Decoy Work Screen */}
            <button
              onClick={handleDecoyDesktop}
              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-24 transition-all ${
                decoyActive ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <Eye size={18} className={decoyActive ? 'text-white' : 'text-purple-500'} />
                <span className="text-[10px] font-bold uppercase">{decoyActive ? 'LIVE' : 'OFF'}</span>
              </div>
              <div>
                <div className="font-bold">Decoy Work Screen</div>
                <div className={`text-[10px] ${decoyActive ? 'text-white/80' : 'text-neutral-400'}`}>Fake Spreadsheet</div>
              </div>
            </button>
          </div>

          {/* Emergency Panic Actions */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Tactical Hot Actions</div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleBeacon}
                className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center gap-2 text-neutral-800 font-medium"
              >
                <Radio size={16} className="text-purple-600" />
                <span>19.5kHz Ultrasonic Beacon</span>
              </button>

              <button
                onClick={handleFlipLock}
                className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center gap-2 text-neutral-800 font-medium"
              >
                <Lock size={16} className="text-blue-600" />
                <span>Flip-to-Lock & Mute</span>
              </button>

              <button
                onClick={handleKernelPanic}
                className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center gap-2 text-neutral-800 font-medium"
              >
                <Skull size={16} className="text-red-500" />
                <span>Fake Kernel Panic</span>
              </button>

              <button
                onClick={handleSilentWipe}
                className="p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl flex items-center gap-2 font-medium"
              >
                <Trash2 size={16} className="text-red-600" />
                <span>Emergency Silent Wipe</span>
              </button>
            </div>
          </div>

          {/* Ultrasonic RF Bug Spectrum */}
          <div className="pt-2">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Room RF & Ultrasonic Bug Scanner (16-Band FFT)
            </div>
            <div className="bg-neutral-900 rounded-2xl p-3 border border-neutral-800 text-white flex items-end justify-between h-20 gap-1">
              {rfBands.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all duration-300"
                    style={{ height: `${Math.min(100, Math.max(10, 100 + b.db))}%` }}
                  />
                  <span className="text-[8px] text-neutral-400 font-mono hidden sm:inline">{b.freq}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
