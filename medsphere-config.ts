// ============================================================================
// package.json
// ============================================================================
// {
//   "name": "medsphere-ai",
//   "private": true,
//   "version": "1.0.0",
//   "type": "module",
//   "scripts": {
//     "dev": "vite",
//     "build": "tsc -b && vite build",
//     "preview": "vite preview",
//     "lint": "eslint .",
//     "format": "prettier --write .",
//     "typecheck": "tsc -b --noEmit",
//     "test": "vitest run",
//     "test:e2e": "playwright test",
//     "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
//   },
//   "dependencies": {
//     "@hookform/resolvers": "^3.9.1",
//     "@supabase/supabase-js": "^2.47.10",
//     "@tanstack/react-query": "^5.62.7",
//     "ably": "^2.5.0",
//     "chart.js": "^4.4.7",
//     "clsx": "^2.1.1",
//     "gsap": "^3.12.5",
//     "react": "^19.0.0",
//     "react-dom": "^19.0.0",
//     "react-hook-form": "^7.54.1",
//     "react-icons": "^5.4.0",
//     "react-router-dom": "^7.1.0",
//     "tailwind-merge": "^2.6.0",
//     "zod": "^3.24.1",
//     "zustand": "^5.0.2"
//   },
//   "devDependencies": {
//     "@eslint/js": "^9.17.0",
//     "@testing-library/jest-dom": "^6.6.3",
//     "@testing-library/react": "^16.1.0",
//     "@types/react": "^19.0.2",
//     "@types/react-dom": "^19.0.2",
//     "@vitejs/plugin-react": "^4.3.4",
//     "autoprefixer": "^10.4.20",
//     "eslint": "^9.17.0",
//     "eslint-plugin-react-hooks": "^5.1.0",
//     "jsdom": "^25.0.1",
//     "playwright": "^1.49.1",
//     "postcss": "^8.4.49",
//     "prettier": "^3.4.2",
//     "tailwindcss": "^3.4.17",
//     "typescript": "^5.7.2",
//     "typescript-eslint": "^8.18.1",
//     "vite": "^6.0.5",
//     "vite-plugin-pwa": "^0.21.1",
//     "vitest": "^2.1.8"
//   }
// }

// ============================================================================
// vite.config.ts
// ============================================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export const viteConfig = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['offline.html', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'MedSphere AI',
        short_name: 'MedSphere',
        description: 'National Intelligent Public Health & Emergency Response Platform',
        theme_color: '#0e7490',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/app|^\/login|^\/$/, /^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // App shell + pages: network-first with offline fallback
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
          {
            // Supabase reads: stale-while-revalidate so records work offline
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-reads',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'storage',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          data: ['@supabase/supabase-js', '@tanstack/react-query', 'zustand'],
          realtime: ['ably'],
          charts: ['chart.js'],
          motion: ['gsap'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    coverage: { provider: 'v8', thresholds: { lines: 80 } },
  },
} as never);

// ============================================================================
// tsconfig.json
// ============================================================================
// {
//   "compilerOptions": {
//     "target": "ES2022",
//     "useDefineForClassFields": true,
//     "lib": ["ES2022", "DOM", "DOM.Iterable"],
//     "module": "ESNext",
//     "moduleResolution": "bundler",
//     "jsx": "react-jsx",
//     "strict": true,
//     "noUncheckedIndexedAccess": true,
//     "noFallthroughCasesInSwitch": true,
//     "noEmit": true,
//     "isolatedModules": true,
//     "skipLibCheck": true,
//     "types": ["vite/client", "vite-plugin-pwa/client"],
//     "baseUrl": ".",
//     "paths": { "@/*": ["src/*"] }
//   },
//   "include": ["src", "vite.config.ts", "tailwind.config.ts", "eslint.config.js"]
// }

// ============================================================================
// tailwind.config.ts  (Material-3 / Fluent-inspired medical design tokens)
// ============================================================================
import type { Config } from 'tailwindcss';

export const tailwindConfig = {
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

// ============================================================================
// postcss.config.js            →  export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
// .prettierrc                  →  { "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
// ============================================================================

// ============================================================================
// eslint.config.js
// ============================================================================
// import js from '@eslint/js';
// import tseslint from 'typescript-eslint';
// import reactHooks from 'eslint-plugin-react-hooks';
// export default tseslint.config(
//   { ignores: ['dist', 'coverage', 'playwright-report'] },
//   js.configs.recommended,
//   ...tseslint.configs.strictTypeChecked,
//   { plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
//   { rules: { '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }] } },
// );

// ============================================================================
// src/index.css
// ============================================================================
// @tailwind base;
// @tailwind components;
// @tailwind utilities;
//
// @layer base {
//   html { @apply scroll-smooth; }
//   body { @apply bg-surface-soft text-slate-800 antialiased dark:bg-surface-dark dark:text-slate-100; }
//   :focus-visible { @apply outline-none ring-2 ring-brand-500 ring-offset-2 ring-offset-surface dark:ring-offset-surface-dark rounded-md; }
//   * { scrollbar-width: thin; scrollbar-color: theme('colors.slate.300') transparent; }
// }
// @layer components {
//   .glass { @apply bg-white/70 backdrop-blur-xl dark:bg-surface-dark-soft/70 border border-white/40 dark:border-white/10; }
// }
// @media (prefers-reduced-motion: reduce) {
//   *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
// }

// ============================================================================
// index.html (head excerpt)
// ============================================================================
// <!doctype html><html lang="en" class="h-full"><head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
//   <meta name="theme-color" content="#0e7490" />
//   <meta name="description" content="MedSphere AI — National Public Health & Emergency Response Platform" />
//   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
//   <title>MedSphere AI</title>
// </head><body class="h-full"><div id="root" class="h-full"></div>
// <script type="module" src="/src/main.tsx"></script></body></html>

// ============================================================================
// public/_headers   (Cloudflare Pages — strict CSP, HSTS, anti-clickjacking)
// ============================================================================
// /*
//   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
//   X-Content-Type-Options: nosniff
//   X-Frame-Options: DENY
//   Referrer-Policy: strict-origin-when-cross-origin
//   Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)
//   Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ably.io wss://*.ably.io https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
//
// /assets/*
//   Cache-Control: public, max-age=31536000, immutable

// ============================================================================
// public/_redirects  (SPA fallback)
// ============================================================================
// /*    /index.html   200

// ============================================================================
// wrangler.toml (Cloudflare Pages project)
// ============================================================================
// name = "medsphere-ai"
// pages_build_output_dir = "dist"
// compatibility_date = "2025-01-01"

// ============================================================================
// .env.example
// ============================================================================
// # --- Client (safe to expose; RLS is the security boundary) ---
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
// VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
// VITE_APP_NAME="MedSphere AI"
// # --- Server-only: set with `supabase secrets set` (NEVER in repo/client) ---
// # ABLY_API_KEY=appKeyId:appKeySecret
// # SUPABASE_SERVICE_ROLE_KEY=auto-injected into edge functions