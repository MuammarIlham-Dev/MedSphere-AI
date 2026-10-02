/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
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
} as any);
