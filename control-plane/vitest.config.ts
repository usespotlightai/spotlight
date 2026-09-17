import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const shared = {
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@platform': resolve(__dirname, 'src/platform'),
      '@shared-kernel': resolve(__dirname, 'src/shared-kernel'),
      '@work': resolve(__dirname, 'src/contexts/work'),
      '@runners': resolve(__dirname, 'src/contexts/runners'),
      '@change-review': resolve(__dirname, 'src/contexts/change-review'),
      '@github': resolve(__dirname, 'src/contexts/github'),
      '@integrations': resolve(__dirname, 'src/contexts/integrations'),
      '@configuration': resolve(__dirname, 'src/contexts/configuration'),
      '@identity': resolve(__dirname, 'src/contexts/identity'),
      '@': resolve(__dirname, 'src'),
    },
  },
};

export default defineConfig({
  test: {
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
          env: {
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
            GITHUB_APP_ID: 'test-app-id',
            GITHUB_APP_PRIVATE_KEY: 'test-private-key',
          },
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
