import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        brand: {
          50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63', 950: '#083344',
        },
        surface: {
          DEFAULT: '#ffffff', soft: '#f8fafc', muted: '#f1f5f9',
          dark: '#0b1220', 'dark-soft': '#0f172a', 'dark-muted': '#1e293b',
        },
        success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#2563eb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px -12px rgb(15 23 42 / 0.18)',
        lift: '0 12px 32px -12px rgb(8 145 178 / 0.35)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(220 38 38 / .5)' }, '100%': { boxShadow: '0 0 0 24px transparent' } },
      },
      animation: { 'fade-up': 'fade-up .5s ease both', 'sos-ring': 'pulseRing 1.6s ease-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
