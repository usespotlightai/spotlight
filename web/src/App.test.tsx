import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '@/hooks/api/useSession';
import App from './App';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: {
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      teams: [{ id: 'team_1', name: 'Acme' }],
    },
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));

vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: { all: ['runners'] },
  useRunners: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useWorkspaces', () => ({
  useWorkspaces: () => ({
    data: [{ id: 'ws_1', name: 'Acme', slug: 'acme' }],
    isPending: false,
  }),
}));

const mockSession = vi.mocked(useSession);

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const signedIn = () =>
  mockSession.mockReturnValue({
    data: { user: { email: 'dev@example.com' } },
    isPending: false,
  } as never);

const signedOut = () =>
  mockSession.mockReturnValue({ data: null, isPending: false } as never);

beforeEach(() => {
  mockSession.mockReset();
});

describe('routing', () => {
  it('sends an unknown path on to the default workspace when signed in', async () => {
    signedIn();

    renderAt('/definitely-not-a-page');

    expect(
      await screen.findByRole('heading', { name: /Acme\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('resolves "/" to the workspace rather than a page of its own', async () => {
    signedIn();

    renderAt('/');

    expect(
      await screen.findByRole('heading', { name: /Acme\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('sends an unknown path to the login screen when signed out', async () => {
    signedOut();

    renderAt('/definitely-not-a-page');

    expect(await screen.findByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('keeps the login screen reachable when signed out', async () => {
    signedOut();

    renderAt('/login');

    expect(
      await screen.findByPlaceholderText('Email address'),
    ).toBeInTheDocument();
  });
});
