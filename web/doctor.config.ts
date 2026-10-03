import { defineConfig } from 'react-doctor/api';

export default defineConfig({
  blocking: 'warning',
  rules: {
    'react-doctor/prefer-dynamic-import': 'off',
  },
  ignore: {
    files: ['src/lib/api/**'],
    overrides: [
      {
        files: ['src/hooks/api/useSignIn.ts'],
        rules: ['react-doctor/query-mutation-missing-invalidation'],
      },
      {
        files: ['src/stories/StoryShell.tsx'],
        rules: ['react-doctor/no-prop-callback-in-render'],
      },
    ],
  },
});
