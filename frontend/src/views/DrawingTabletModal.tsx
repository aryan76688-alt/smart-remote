import React, { useRef, useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Check, Trash2, PenTool, Edit3, Sparkles } from 'lucide-react';

interface DrawingTabletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DrawingTabletModal: React.FC<DrawingTabletModalProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#007AFF');
  const [penWidth, setPenWidth] = useState(3);
  const [stampedNotice, setStampedNotice] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 360;
      canvas.height = canvas.parentElement?.clientHeight || 450;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
    }
    // Stream normalized coordinates to pearOS cursor
    api.sendTabletStroke(x / canvas.width, y / canvas.height, e.pressure || 1.0, true, false).catch(() => null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    api.sendTabletStroke(x / canvas.width, y / canvas.height, e.pressure || 1.0, false, false).catch(() => null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    api.sendTabletStroke(x / canvas.width, y / canvas.height, 0.0, false, true).catch(() => null);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleStampSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      await api.insertSignature(dataUrl);
      setStampedNotice(true);
      setTimeout(() => {
        setStampedNotice(false);
        onClose();
      }, 900);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <PenTool size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Stylus & Signature Tablet</h3>
              <p className="text-[11px] text-neutral-500">Wireless X11 Coordinate Mapping</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-neutral-100 text-neutral-500">
            <X size={16} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-neutral-50 relative touch-none">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full cursor-crosshair"
          />
          {stampedNotice && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                <Check size={24} />
              </div>
              <div className="text-sm font-bold text-neutral-900">Signature Stamped!</div>
              <div className="text-xs text-neutral-500">Injected into pearOS active document</div>
            </div>
          )}
        </div>

        {/* Tools Footer */}
        <div className="p-3 bg-white border-t border-neutral-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {['#007AFF', '#000000', '#FF3B30', '#34C759'].map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === c ? 'scale-110 border-neutral-400' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
              title="Clear"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={handleStampSignature}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Check size={14} /> Stamp Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
