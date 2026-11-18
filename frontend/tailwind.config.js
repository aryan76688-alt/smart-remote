/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stitch: {
          bg: '#0b0e18',
          surface: '#11131d',
          container: '#1d1f2a',
          high: '#272935',
          highest: '#323440',
          primary: '#aac7ff',
          primaryStrong: '#3e90ff',
          secondary: '#47e266',
          secondaryStrong: '#09bf49',
          tertiary: '#e9b3ff',
          tertiaryStrong: '#c863fb',
          error: '#ffb4ab',
          errorStrong: '#ff3b30',
          errorContainer: '#93000a',
          text: '#e1e1f1',
          muted: '#c0c6d6',
          outline: '#8b91a0',
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
