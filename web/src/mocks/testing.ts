import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { client } from '@/lib/api/client.gen';
import { handlers } from '@/mocks/handlers';
import { type PageState, setScenario } from '@/mocks/scenario';

export const useMockApi = (state: PageState = 'data') => {
  const server = setupServer(...handlers);

  beforeAll(() => {
    client.setConfig({ baseUrl: `${window.location.origin}/api` });
    server.listen({ onUnhandledRequest: 'error' });
  });
  beforeEach(() => setScenario({ state }));
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
    client.setConfig({ baseUrl: '/api' });
  });

  return server;
};
