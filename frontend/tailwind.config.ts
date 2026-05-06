import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Semantic tokens — automatically swap with CSS variables per theme
        background: 'rgb(var(--background) / <alpha-value>)',
        surface:    'rgb(var(--surface) / <alpha-value>)',
        'surface-2':'rgb(var(--surface-2) / <alpha-value>)',
        border:     'rgb(var(--border) / <alpha-value>)',
        fg:         'rgb(var(--fg) / <alpha-value>)',
        'fg-soft':  'rgb(var(--fg-soft) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up':   'slideUp 0.25s ease-out both',
        'fade-in':    'fadeIn 0.3s ease-out both',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
