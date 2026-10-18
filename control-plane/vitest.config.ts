import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import {
  databaseNamed,
  E2E_DATABASE,
  E2E_SERVER,
} from './test/support/e2e-database-url';
import { E2E_LONG_POLL_MS } from './test/support/long-poll';

// Do not use the app's own database. A control plane on that database takes the work of the tests.
const E2E_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  DATABASE_URL: databaseNamed(E2E_SERVER, E2E_DATABASE),
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_APP_ID: 'test-app-id',
  GITHUB_APP_PRIVATE_KEY: 'test-private-key',
  BETTER_AUTH_SECRET: 'test-better-auth-secret-not-a-real-one',
  BETTER_AUTH_URL: 'http://localhost:3000',
  SPOTLIGHT_SECRETS_KEY: 'S9+m23g9lI8X4VNFd0ayFXJH7P14Q3GZGsNvjCglc/Q=',
  SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS: '127.0.0.1',
  S3_BUCKET: 'files',
  SPOTLIGHT_LONG_POLL_MS: String(E2E_LONG_POLL_MS),
};

const shared = {
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@platform': resolve(__dirname, 'src/platform'),
      '@shared-kernel': resolve(__dirname, 'src/shared-kernel'),
      '@work': resolve(__dirname, 'src/contexts/work'),
      '@runners': resolve(__dirname, 'src/contexts/runners'),
      '@change-review': resolve(__dirname, 'src/contexts/change-review'),
      '@memory': resolve(__dirname, 'src/contexts/memory'),
      '@insights': resolve(__dirname, 'src/contexts/insights'),
      '@replays': resolve(__dirname, 'src/contexts/replays'),
      '@github': resolve(__dirname, 'src/contexts/github'),
      '@integrations': resolve(__dirname, 'src/contexts/integrations'),
      '@configuration': resolve(__dirname, 'src/contexts/configuration'),
      '@identity': resolve(__dirname, 'src/contexts/identity'),
      '@secrets': resolve(__dirname, 'src/contexts/secrets'),
      '@catalog': resolve(__dirname, 'src/contexts/catalog'),
      '@': resolve(__dirname, 'src'),
    },
  },
};

export default defineConfig({
  test: {
    fsModuleCache: true,
    projects: [
      {
        ...shared,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.ts'],
          restoreMocks: true,
        },
      },
      {
        ...shared,
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/**/*.e2e-spec.ts'],
          restoreMocks: true,
          isolate: false,
          env: E2E_ENV,
          globalSetup: ['test/support/e2e-database.ts'],
          setupFiles: ['test/support/one-query-per-client.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
