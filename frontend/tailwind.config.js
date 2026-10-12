/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#030712',
          void: '#030712',
          tier1: '#090d16',
          tier2: '#0d1117',
          surface: '#090d16',
          card: '#0d1117',
          border: 'rgba(0, 240, 255, 0.15)',
          neon: '#00f0ff',
          cyan: '#00f0ff',
          emerald: '#10b981',
          rose: '#ef4444',
          breach: '#ef4444',
          amber: '#f59e0b',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
