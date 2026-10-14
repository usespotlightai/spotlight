import { afterAll, beforeAll, vi } from 'vitest';

export const signedInSession = () => ({
  data: {
    user: {
      id: 'user_1',
      name: 'Sam Rivera',
      email: 'sam@example.com',
      image: null,
    },
    session: { id: 'session_1', userId: 'user_1' },
  },
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: async () => undefined,
});

class QuietStream {
  onmessage: (() => void) | null = null;
  close() {}
}

const quietMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

export const quietBrowser = () => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', QuietStream);
    vi.stubGlobal('matchMedia', quietMedia);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
};
