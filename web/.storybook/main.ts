import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  core: {
    disableTelemetry: true,
  },
  viteFinal: (vite) => ({
    ...vite,
    server: {
      ...vite.server,
      watch: { ...vite.server?.watch, usePolling: true, interval: 300 },
    },
  }),
};

export default config;
