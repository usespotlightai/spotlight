import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const shared = {
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'src/domain'),
      '@application': resolve(__dirname, 'src/application'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@presentation': resolve(__dirname, 'src/presentation'),
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
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
