import type { UseQueryResult } from '@tanstack/react-query';
import { afterAll, beforeAll, vi } from 'vitest';

import type { Session } from '@/hooks/api/useSession';
import { partial } from '@/test/partial';

export const signedInSession = (): UseQueryResult<Session | null> =>
  partial<UseQueryResult<Session | null>>({
    data: {
      user: {
        id: 'user_1',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        image: null,
      },
    },
    isPending: false,
    isRefetching: false,
    error: null,
  });

class QuietStream {
  onmessage: (() => void) | null = null;
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const quietMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

export const quietBrowser = (): void => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', QuietStream);
    vi.stubGlobal('matchMedia', quietMedia);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
};
