import { deviceAuthorizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { send } from '@/lib/send';

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: send },
  plugins: [deviceAuthorizationClient()],
});
