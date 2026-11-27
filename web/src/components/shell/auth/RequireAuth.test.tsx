import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/shell/auth/RequireAuth';
import { type SessionUser, useSession } from '@/hooks/api/useSession';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { partial } from '@/test/partial';

type SessionState = ReturnType<typeof useSession>;
type WorkspacesState = ReturnType<typeof useWorkspaces>;
type Workspace = NonNullable<WorkspacesState['data']>[number];

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/api/useWorkspaces', () => ({ useWorkspaces: vi.fn() }));
vi.mock('@/hooks/useQueryCacheOwner', () => ({
  useQueryCacheOwnedBy: () => true,
}));

const mockSession = vi.mocked(useSession);
const mockWorkspaces = vi.mocked(useWorkspaces);

const signedIn = () =>
  mockSession.mockReturnValue(
    partial<SessionState>({
      data: { user: partial<SessionUser>({ email: 'dev@example.com' }) },
      isPending: false,
    }),
  );

const owning = (count: number) =>
  mockWorkspaces.mockReturnValue(
    partial<WorkspacesState>({
      data: Array.from({ length: count }, (_, index) =>
        partial<Workspace>({
          id: `ws_${index}`,
          name: 'Acme',
          slug: 'acme',
        }),
      ),
      isPending: false,
      errorUpdateCount: 0,
    }),
  );

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login screen</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>protected page</p>} />
          <Route path="/workspaces/new" element={<p>workspace setup</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSession.mockReset();
  mockWorkspaces.mockReset();
  owning(1);
});

describe('RequireAuth', () => {
  it('renders the page when a session exists', () => {
    signedIn();

    renderAt('/');

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('redirects to the login screen without a session', () => {
    mockSession.mockReturnValue(
      partial<SessionState>({ data: null, isPending: false }),
    );

    renderAt('/');

    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('renders neither while the session is still resolving', () => {
    mockSession.mockReturnValue(
      partial<SessionState>({ data: undefined, isPending: true }),
    );

    renderAt('/');

    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });

  it('waits for the workspace list before deciding where to send anyone', () => {
    signedIn();
    mockWorkspaces.mockReturnValue(
      partial<WorkspacesState>({
        data: undefined,
        isPending: true,
        errorUpdateCount: 0,
      }),
    );

    renderAt('/');

    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();
  });

  it('sends a member of no workspace to create one', () => {
    signedIn();
    owning(0);

    renderAt('/');

    expect(screen.getByText('workspace setup')).toBeInTheDocument();
  });

  it('leaves workspace setup reachable to someone who already has one', () => {
    signedIn();

    renderAt('/workspaces/new');

    expect(screen.getByText('workspace setup')).toBeInTheDocument();
  });

  it('does not bounce away from the setup page it just sent them to', () => {
    signedIn();
    owning(0);

    renderAt('/workspaces/new');

    expect(screen.getByText('workspace setup')).toBeInTheDocument();
  });

  it('does not send anyone to create a workspace when the list could not be loaded', () => {
    signedIn();
    mockWorkspaces.mockReturnValue(
      partial<WorkspacesState>({
        data: undefined,
        isPending: false,
        errorUpdateCount: 1,
      }),
    );

    renderAt('/');

    expect(screen.getByText('protected page')).toBeInTheDocument();
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();
  });
});
