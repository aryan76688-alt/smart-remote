/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          primary: '#0066cc',
          focus: '#0071e3',
          onDark: '#2997ff',
          ink: '#1d1d1f',
          ink80: '#333333',
          ink48: '#7a7a7a',
          mutedDark: '#cccccc',
          divider: '#f0f0f0',
          hairline: '#e0e0e0',
          canvas: '#ffffff',
          parchment: '#f5f5f7',
          pearl: '#fafafc',
          tile1: '#272729',
          tile2: '#2a2a2c',
          tile3: '#252527',
          black: '#000000',
          chip: '#d2d2d7',
          rec: '#ff3b30',
        }
      },
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'apple-xs': '5px',
        'apple-sm': '8px',
        'apple-md': '11px',
        'apple-lg': '18px',
      }
    },
  },
  plugins: [],
}
