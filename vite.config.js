import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Edge Finder - Live Odds Tracker',
        short_name: 'EdgeFinder',
        description: 'Live odds, fair lines, and +EV betting analytics',
        theme_color: '#0a0f1a',
        background_color: '#0a0f1a',
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
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
