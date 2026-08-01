/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0A0F',
        slatecard: '#16161D',
        slatecard2: '#1C1C26',
        gold: {
          DEFAULT: '#D4AF37',
          soft: '#E8C766',
          deep: '#A8841F',
        },
        emerald2: '#10B981',
        crimson: '#E63946',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(212,175,55,0.45)',
        'glow-sm': '0 0 12px -4px rgba(212,175,55,0.5)',
        'glow-emerald': '0 0 24px -6px rgba(16,185,129,0.45)',
        'glow-crimson': '0 0 24px -6px rgba(230,57,70,0.45)',
        card: '0 8px 30px -12px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' },
          '50%': { boxShadow: '0 0 24px 2px rgba(212,175,55,0.25)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
