import { mergeHeaders } from '@/lib/api/client';
import type { CreateClientConfig } from '@/lib/api/client.gen';
import { send } from '@/lib/send';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  fetch: send,
  headers: mergeHeaders(config?.headers, { 'Spotlight-Client': 'web' }),
});
