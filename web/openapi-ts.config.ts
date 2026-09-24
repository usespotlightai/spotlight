import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../control-plane/openapi.json',
  output: {
    path: 'src/lib/api',
    postProcess: [],
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: './src/lib/api-client',
    },
  ],
});
