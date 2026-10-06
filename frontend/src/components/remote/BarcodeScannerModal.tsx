import React, { useState, useEffect, useRef } from 'react';
import { QrCode, X, Check, Copy, Camera, Zap, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose }) => {
  const { triggerHaptic } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [typingToKali, setTypingToKali] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanningActive, setScanningActive] = useState<boolean>(true);

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(err.message || 'Camera permission denied or camera not found');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setScanningActive(true);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  // Barcode / QR Detection loop
  useEffect(() => {
    if (!isOpen || !scanningActive) return;

    let timerId: any;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'data_matrix']
        });
      } catch (e) {
        console.warn('BarcodeDetector error', e);
      }
    }

    const checkFrame = async () => {
      if (detector && videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue !== lastScanned) {
              triggerHaptic(50);
              setLastScanned(rawValue);
              // Auto-type directly into Kali
              handleTypeToKali(rawValue);
            }
          }
        } catch {
          // ignore detection errors
        }
      }
      if (scanningActive) {
        timerId = setTimeout(checkFrame, 250);
      }
    };

    timerId = setTimeout(checkFrame, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [isOpen, scanningActive, lastScanned]);

  const handleTypeToKali = async (text: string) => {
    try {
      setTypingToKali(true);
      await api.setClipboard(text, true);
    } catch (err: any) {
      console.error('Failed to type to Kali', err);
    } finally {
      setTimeout(() => setTypingToKali(false), 800);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl safe-bottom animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">QR & BARCODE SCANNER</h2>
              <p className="text-[10px] text-slate-400 font-mono">Scan directly into Kali active window</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/30 flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-center text-rose-400 text-xs space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
              <div>{cameraError}</div>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs mt-2"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Scan target reticle overlay */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400/80 animate-pulse" />
              </div>
            </>
          )}
        </div>

        {/* Scan Result & Kali Sync Banner */}
        {lastScanned && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-emerald-300">
              <span className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                Scanned & Typed to Kali!
              </span>
              {typingToKali && <span className="animate-spin text-[10px]">⚡ Typing...</span>}
            </div>
            <div className="bg-slate-950/80 p-2 rounded-lg text-slate-200 break-all select-all text-[11px]">
              {lastScanned}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleTypeToKali(lastScanned)}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" /> Type Again
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastScanned);
                  triggerHaptic(20);
                }}
                className="p-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center justify-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-500 text-center font-mono">
          Point camera at standard QR code, Wi-Fi code, or product barcode.
        </div>
      </div>
    </div>
  );
};
