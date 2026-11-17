import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { X, Play, Pause, RotateCcw, FlipHorizontal, Type, Volume2 } from 'lucide-react';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeleprompterModal: React.FC<TeleprompterModalProps> = ({ isOpen, onClose }) => {
  const [script, setScript] = useState(
    "Welcome to pearOS Smart Remote 2.0.\n\n" +
    "Today we are demonstrating the complete 50-feature continuity and tactical suite.\n\n" +
    "All video streams, acoustic tripwires, OCR document scans, and AI agent copilots operate exclusively in pure RAM with zero disk writes.\n\n" +
    "Notice the seamless sub-millisecond X11 native keyboard and mouse response.\n\n" +
    "Thank you for watching."
  );
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [fontSize, setFontSize] = useState(36);
  const [mirrored, setMirrored] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    if (scrolling && containerRef.current) {
      const scrollStep = () => {
        if (containerRef.current) {
          containerRef.current.scrollTop += speed;
        }
        animId = requestAnimationFrame(scrollStep);
      };
      animId = requestAnimationFrame(scrollStep);
    }
    return () => cancelAnimationFrame(animId);
  }, [scrolling, speed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col select-none animate-fadeIn">
      {/* Top Controls */}
      <div className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest">
            Teleprompter Pro
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">
            {speed}x
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScrolling(!scrolling)}
            className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all ${
              scrolling ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'
            }`}
          >
            {scrolling ? <Pause size={14} /> : <Play size={14} />}
            <span>{scrolling ? 'Pause' : 'Scroll'}</span>
          </button>

          <button
            onClick={() => {
              if (containerRef.current) containerRef.current.scrollTop = 0;
            }}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            title="Reset to Top"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={() => setMirrored(!mirrored)}
            className={`p-2 rounded-xl text-neutral-300 ${mirrored ? 'bg-blue-600 text-white' : 'bg-neutral-800'}`}
            title="Mirror for Glass Prompters"
          >
            <FlipHorizontal size={14} />
          </button>

          <button
            onClick={() => setFontSize(fontSize === 36 ? 48 : fontSize === 48 ? 24 : 36)}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold"
            title="Font Size"
          >
            <Type size={14} />
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2.5 py-1.5 rounded-xl bg-neutral-800 text-xs text-neutral-300"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Prompter Text Area */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-y-auto no-scrollbar px-8 py-24 text-center leading-relaxed font-sans ${
          mirrored ? 'scale-x-[-1]' : ''
        }`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {isEditing ? (
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="w-full h-full bg-neutral-900 text-white p-6 rounded-2xl text-lg font-mono focus:outline-none"
          />
        ) : (
          <div className="max-w-3xl mx-auto whitespace-pre-wrap font-medium">
            {script}
          </div>
        )}
      </div>

      {/* Speed Slider Footer */}
      <div className="h-12 bg-neutral-900 border-t border-neutral-800 px-6 flex items-center justify-between text-xs text-neutral-400">
        <span>Slower</span>
        <input 
          type="range"
          min="0.5"
          max="4.0"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-48 accent-blue-500"
        />
        <span>Faster</span>
      </div>
    </div>
  );
};
