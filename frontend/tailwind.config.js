/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stitch: {
          bg: '#eef3fb',
          surface: '#f5f8fd',
          container: '#ffffff',
          high: '#f1f5f9',
          highest: '#e2e8f0',
          primary: '#0062cc',
          primaryStrong: '#007AFF',
          secondary: '#15803d',
          secondaryStrong: '#22c55e',
          tertiary: '#7e22ce',
          tertiaryStrong: '#9333ea',
          error: '#dc2626',
          errorStrong: '#ef4444',
          errorContainer: '#fee2e2',
          text: '#0f172a',
          muted: '#475569',
          outline: '#64748b',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'sans-serif'],
        display: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backdropBlur: {
        '3xl': '36px',
      }
    },
  },
  plugins: [],
}
