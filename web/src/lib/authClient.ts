import { createAuthClient } from 'better-auth/react';
import { send } from '@/lib/send';

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: send },
});
