import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { alphaTab } from '@coderline/alphatab-vite';

export default defineConfig({
  // alphaTab plugin serves its worker, audio worklet, music fonts and the SoundFont.
  plugins: [react(), alphaTab()],
  // Relative base so the built index.html also loads from file:// inside Electron.
  base: './',
  // Fixed port so electron:dev knows where to connect (5173 is often taken by other projects).
  server: { port: 5317, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
