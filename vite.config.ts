import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
