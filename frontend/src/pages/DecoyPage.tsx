import React, { useState, useEffect } from 'react';

export const DecoyPage: React.FC = () => {
  const [percent, setPercent] = useState<number>(27);

  // Gradually increment percentage very slowly so it looks 100% genuine
  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => (prev < 98 ? prev + 1 : prev));
    }, 18000);
    return () => clearInterval(interval);
  }, []);

  // Hidden escape mechanism: Press Escape or click top-left to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fetch('/api/security/decoy/close', { method: 'POST' }).catch(() => {});
        window.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSecretExit = () => {
    fetch('/api/security/decoy/close', { method: 'POST' }).catch(() => {});
    window.close();
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#000000] text-white flex flex-col items-center justify-center select-none cursor-none overflow-hidden font-sans">
      {/* Hidden exit button in top left */}
      <div
        onClick={handleSecretExit}
        className="absolute top-0 left-0 w-12 h-12 z-50 cursor-default opacity-0"
        title=""
      />

      {/* Windows 11 / OS Style Loading Spinner */}
      <div className="relative w-16 h-16 mb-8 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-cyan-400/40 border-l-transparent animate-spin" />
      </div>

      {/* Realistic Update Text */}
      <div className="text-center space-y-3 px-6">
        <h1 className="text-xl sm:text-2xl font-light tracking-wide text-slate-100">
          Working on updates {percent}%
        </h1>
        <p className="text-sm font-light text-slate-400">
          Don't turn off your PC. This will take a while.
        </p>
        <p className="text-xs font-light text-slate-500 pt-2">
          Your PC may restart several times.
        </p>
      </div>
    </div>
  );
};
