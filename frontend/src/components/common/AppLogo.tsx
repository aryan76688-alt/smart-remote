import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 32,
  glow = true
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div className="absolute inset-0 rounded-2xl bg-cyan-500/25 blur-[6px] pointer-events-none -z-10" />
      )}
      <svg
        viewBox="0 0 108 108"
        width={size}
        height={size}
        className="w-full h-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="srLogoBg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#142442" />
            <stop offset="60%" stopColor="#0a1324" />
            <stop offset="100%" stopColor="#050811" />
          </radialGradient>
          <linearGradient id="srNeonBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <radialGradient id="srScreenGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#081b33" />
            <stop offset="100%" stopColor="#040914" />
          </radialGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="100"
          height="100"
          rx="22"
          fill="url(#srLogoBg)"
          stroke="url(#srNeonBorder)"
          strokeWidth="2.5"
        />
        <rect
          x="8.5"
          y="8.5"
          width="91"
          height="91"
          rx="18"
          stroke="#10b981"
          strokeWidth="0.8"
          strokeOpacity="0.3"
        />
        <path
          d="M38 27 A 19 19 0 0 1 70 27"
          stroke="#10b981"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M43 32 A 13 13 0 0 1 65 32"
          stroke="#06b6d4"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M48 37 A 7 7 0 0 1 60 37"
          stroke="#00e5ff"
          strokeWidth="2.0"
          strokeLinecap="round"
        />
        <circle cx="54" cy="40.5" r="2" fill="#00e5ff" />
        <rect
          x="19"
          y="48"
          width="70"
          height="34"
          rx="14"
          fill="#111c33"
          stroke="#00e5ff"
          strokeWidth="2"
        />
        <rect x="26.5" y="62.5" width="11" height="5" rx="1.5" fill="#06b6d4" />
        <rect x="29.5" y="59.5" width="5" height="11" rx="1.5" fill="#06b6d4" />
        <circle cx="32" cy="65" r="1.2" fill="#0a1324" />
        <rect
          x="42"
          y="54"
          width="24"
          height="22"
          rx="5"
          fill="url(#srScreenGlow)"
          stroke="#00e5ff"
          strokeWidth="1.2"
        />
        <path
          d="M46 59.5 L51 64 L46 68.5"
          stroke="#00e5ff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="53.5"
          y1="68.5"
          x2="61"
          y2="68.5"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="77" cy="58" r="2.2" fill="#10b981" />
        <circle cx="77" cy="72" r="2.2" fill="#06b6d4" />
        <circle cx="70" cy="65" r="2.2" fill="#00e5ff" />
        <circle cx="84" cy="65" r="2.2" fill="#34d399" />
        <rect
          x="41"
          y="88"
          width="26"
          height="5"
          rx="2.5"
          fill="#06b6d4"
          fillOpacity="0.4"
          stroke="#06b6d4"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
};
