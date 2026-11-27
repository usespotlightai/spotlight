import { defineConfig } from 'react-doctor/api';

export default defineConfig({
  blocking: 'warning',
  rules: {
    'react-doctor/prefer-dynamic-import': 'off',
  },
  ignore: {
    files: [
      'src/lib/api/**',
      'src/components/ui/**',
      'src/components/shared/icons/**',
    ],
    overrides: [
      {
        files: ['src/hooks/api/useSignIn.ts'],
        rules: ['react-doctor/query-mutation-missing-invalidation'],
      },
    ],
  },
});
