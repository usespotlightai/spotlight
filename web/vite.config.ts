import path from 'node:path';

import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const buildId = process.env.SENTRY_RELEASE || String(Date.now());

export default defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [
    react(),
    babel({
      presets: [
        reactCompilerPreset({
          panicThreshold: command === 'build' ? 'all_errors' : 'none',
        }),
      ],
    }),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: sentryAuthToken,
      disable: !sentryAuthToken,
      telemetry: false,
      release: { name: process.env.SENTRY_RELEASE, inject: false },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }),
  ],
  build: {
    sourcemap: sentryAuthToken ? 'hidden' : false,
  },
  server: {
    allowedHosts: ['.dev.usespotlight.ai'],
    watch: {
      // After some time, inotify events from Docker Desktop do not reach the container.
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
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
}));
