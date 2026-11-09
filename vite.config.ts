import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { alphaTab } from '@coderline/alphatab-vite';
import { VitePWA } from 'vite-plugin-pwa';
// One policy for the desktop app and the web build (meta tag: GitHub Pages can't send headers).
import csp from './electron/csp.cjs';

const { CSP } = csp;


const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  // alphaTab plugin serves its worker, audio worklet, music fonts and the SoundFont.
  plugins: [
    react(),
    alphaTab(),
    cspMeta(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'icons/icon.svg'],
      manifest: {
        name: 'Guitar Cords',
        short_name: 'Cords',
        description: 'Guitar chord and song editor with tab, score and playback.',
        theme_color: '#15120f',
        background_color: '#f6f1e7',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, fonts and the guitar SoundFont, so the app works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,woff,woff2,otf,svg,png,sf2,webmanifest}'],
        // Browsers only need the woff2 music font; skip its other formats.
        globIgnores: ['**/font/Bravura.{svg,otf,woff,eot}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Relative base so the build works from app:// in Electron and from a sub-path on GitHub Pages.
  base: './',
  // Fixed port so electron:dev knows where to connect (5173 is often taken by other projects).
  server: { port: 5317, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
