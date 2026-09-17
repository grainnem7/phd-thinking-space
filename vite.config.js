import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Fonts bundled by the PDF/Word exporters and the PDF.js worker are only
        // needed on demand, so they're cached the first time they're used
        // instead of being downloaded up front with the app.
        globIgnores: ['**/Inter_*', '**/GeistMono-*', '**/pdf.worker*', '**/react-pdf.browser-*'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
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
