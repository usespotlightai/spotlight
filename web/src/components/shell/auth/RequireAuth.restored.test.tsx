import { dehydrate, QueryClient } from '@tanstack/react-query';
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/shell/auth/RequireAuth';
import { sessionQueryKey } from '@/hooks/api/useSession';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { listMemberWorkspaces } from '@/lib/api';
import { authClient } from '@/lib/authClient';
import { forgetQueryCache, ownQueryCache } from '@/lib/query-cache';

vi.mock('@/lib/authClient', () => ({
  authClient: { getSession: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ listMemberWorkspaces: vi.fn() }));

const readSession = vi.mocked(authClient.getSession);
const readWorkspaces = vi.mocked(listMemberWorkspaces);

const BUSTER = 'api_1';

const saved = (): PersistedClient => {
  const earlier = new QueryClient();

  earlier.setQueryData(sessionQueryKey, {
    user: {
      id: 'user_1',
      name: 'Sam Rivera',
      email: 'sam@example.com',
      image: null,
    },
  });
  earlier.setQueryData(workspaceKeys.all, [
    { id: 'ws_1', name: 'Acme', slug: 'acme' },
  ]);

  return {
    timestamp: Date.now(),
    buster: BUSTER,
    clientState: dehydrate(earlier),
  };
};

const persisterWith = (client: PersistedClient | undefined): Persister => ({
  persistClient: async () => undefined,
  restoreClient: async () => client,
  removeClient: async () => undefined,
});

const reload = (client: PersistedClient | undefined) =>
  render(
    <PersistQueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
      persistOptions={{ persister: persisterWith(client), buster: BUSTER }}
    >
      <MemoryRouter initialEntries={['/acme']}>
        <Routes>
          <Route path="/login" element={<p>login screen</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/acme" element={<p>inbox</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PersistQueryClientProvider>,
  );

const never = () => new Promise<never>(() => undefined);

describe('reloading with a saved cache', () => {
  beforeEach(() => {
    readSession.mockReset();
    readWorkspaces.mockReset();
    readWorkspaces.mockImplementation(never);
    ownQueryCache('user_1');
  });

  afterEach(async () => {
    await forgetQueryCache();
  });

  it('shows the page before the server confirms the session', async () => {
    readSession.mockImplementation(never);

    reload(saved());

    expect(await screen.findByText('inbox')).toBeInTheDocument();
  });

  it('shows nothing while the session is read when nothing is saved', async () => {
    readSession.mockImplementation(never);

    const { container } = reload(undefined);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it('sends a person whose session ended to sign in', async () => {
    readSession.mockResolvedValue({ data: null, error: null });

    reload(saved());

    expect(await screen.findByText('login screen')).toBeInTheDocument();
  });
});
