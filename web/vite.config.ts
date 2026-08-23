import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['.dev.usespotlight.ai'],
    watch: {
      // Docker Desktop's file sharing syncs contents into the container but
      // stops delivering inotify events after a while, so the watcher goes
      // deaf and edits stop reloading. Polling is the reliable path.
      usePolling: true,
      interval: 300,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
