import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + our PWAUpdatePrompt component: when a new build ships, the
      // waiting service worker surfaces a visible "Update available" toast
      // instead of silently serving the old bundle. iOS installed PWAs are
      // especially prone to pinning a stale build, which is how comp/Pro
      // users end up stuck on a months-old client that can't auth correctly.
      registerType: 'prompt',
      manifest: {
        name: 'EdgeFinder — Live Odds & Edges',
        short_name: 'EdgeFinder',
        description: 'Compare live odds across sportsbooks to find the best number, line moves, +EV edges, and props before you bet.',
        theme_color: '#070b14',
        background_color: '#070b14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Force new SW to take over immediately
        skipWaiting: true,
        clientsClaim: true,
        // Cache version bump forces SW update on all clients
        additionalManifestEntries: [{ url: '/cache-bust-v3', revision: Date.now().toString() }],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.the-odds-api\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'odds-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 120 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase-vendor';
          if (id.includes('/lucide-react/')) return 'icons-vendor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor';
          return undefined;
        }
      }
    }
  }
})
