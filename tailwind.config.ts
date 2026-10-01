import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        brand: {
          50: '#FFF1F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
          400: '#F87171', 500: '#DC2626', 600: '#981D26', 700: '#8E1B23',
          800: '#7D121B', 900: '#2A0407', 950: '#120103',
          burgundy: '#4A0A10',
          rose: '#FFF1F2'
        },
        surface: {
          canvas: '#FDFBFB', card: '#FFFFFF', subtle: '#F8F9FA'
        },
        border: {
          subtle: '#F1ECEB',
        }
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.5rem', pill: '9999px' },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        hero: '0 10px 25px -5px rgba(125, 18, 27, 0.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'pop-reveal': { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: { 
        'fade-up': 'fade-up .8s cubic-bezier(0.25, 1, 0.5, 1) both',
        'pop-reveal': 'pop-reveal .5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
