import { mergeHeaders } from '@/lib/api/client';
import type { CreateClientConfig } from '@/lib/api/client.gen';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  headers: mergeHeaders(config?.headers, { 'Spotlight-Client': 'web' }),
});
