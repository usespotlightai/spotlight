import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import babel from '@rolldown/plugin-babel';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const apiShape = createHash('sha256')
  .update(
    readFileSync(path.resolve(import.meta.dirname, 'src/lib/api/types.gen.ts')),
  )
  .digest('hex')
  .slice(0, 16);

export default defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_API_SHAPE': JSON.stringify(apiShape),
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
