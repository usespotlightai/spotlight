import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: {
    all: ['runners'],
    forWorkspace: (slug?: string) => ['runners', slug ?? null],
  },
  useRunners: () => ({ data: { hosts: [], provisioned: [] } }),
}));
vi.mock('@/hooks/api/useTeamSkills', () => ({
  useTeamSkills: () => ({
    data: { repository: 'acme/config', skills: [] },
    isPending: false,
    isError: false,
  }),
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
  it('sends an unknown path on to the default workspace’s inbox when signed in', async () => {
    signedIn();

    renderAt('/definitely-not-a-page');

    expect(await screen.findByText('No messages')).toBeInTheDocument();
  });

  it('opens "/" on the workspace’s inbox', async () => {
    signedIn();

    renderAt('/');

    expect(await screen.findByText('No messages')).toBeInTheDocument();
  });

  it('opens the settings at the workspace’s general page', async () => {
    signedIn();

    renderAt('/w/acme/settings');

    expect(await screen.findByText('Workspace name')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'General' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens a team’s settings at its general page', async () => {
    signedIn();

    renderAt('/w/acme/settings/team/team_1');

    await waitFor(async () => {
      const [, ofTeam] = await screen.findAllByRole('link', {
        name: 'General',
      });
      expect(ofTeam).toHaveAttribute('aria-current', 'page');
    });
  });

  it('opens a team’s memory at an address of its own', async () => {
    signedIn();

    renderAt('/w/acme/team/team_1/memory');

    expect(
      await screen.findByRole('link', { name: 'Memory', current: 'page' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/memory');
  });

  it('opens a team’s skills among its settings', async () => {
    signedIn();

    renderAt('/w/acme/settings/team/team_1/skills');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Skills' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Skills', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('sends an unknown path to the login screen when signed out', async () => {
    signedOut();

    renderAt('/definitely-not-a-page');

    expect(
      await screen.findByRole('button', { name: 'Continue with GitHub' }),
    ).toBeInTheDocument();
  });

  it('keeps the login screen reachable when signed out', async () => {
    signedOut();

    renderAt('/login');

    expect(
      await screen.findByRole('button', { name: 'Continue with GitHub' }),
    ).toBeInTheDocument();
  });
});
