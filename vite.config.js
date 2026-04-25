import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Thinking Space',
        short_name: 'Thinking Space',
        description: 'Your personal workspace for notes, tasks, and ideas',
        theme_color: '#171717',
        background_color: '#fafafa',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'vite.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Main app bundle is ~4.7MB; bump precache cap so the SW can include it.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Don't intercept Firebase/Auth/Google network calls
        navigateFallbackDenylist: [
          /^\/__\//,
          /^\/firestore\//,
          /firebase/,
          /googleapis\.com/,
          /identitytoolkit/,
        ],
      },
      devOptions: {
        // Keep PWA disabled in `npm run dev` for faster reloads;
        // test the SW with `npm run build && npm run preview`.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
