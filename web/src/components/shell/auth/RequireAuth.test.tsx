import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/shell/auth/RequireAuth';
import { useSession } from '@/hooks/api/useSession';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/api/useWorkspaces', () => ({ useWorkspaces: vi.fn() }));

const mockSession = vi.mocked(useSession);
const mockWorkspaces = vi.mocked(useWorkspaces);

const signedIn = () =>
  mockSession.mockReturnValue({
    data: { user: { email: 'dev@example.com' } },
    isPending: false,
  } as never);

const owning = (count: number) =>
  mockWorkspaces.mockReturnValue({
    data: Array.from({ length: count }, (_, index) => ({
      id: `ws_${index}`,
      name: 'Acme',
      slug: 'acme',
    })),
    isPending: false,
    errorUpdateCount: 0,
  } as never);

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
    mockSession.mockReturnValue({ data: null, isPending: false } as never);

    renderAt('/');

    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('renders neither while the session is still resolving', () => {
    mockSession.mockReturnValue({ data: null, isPending: true } as never);

    renderAt('/');

    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });

  it('waits for the workspace list before deciding where to send anyone', () => {
    signedIn();
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: true,
      errorUpdateCount: 0,
    } as never);

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
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: false,
      errorUpdateCount: 1,
    } as never);

    renderAt('/');

    expect(screen.getByText('protected page')).toBeInTheDocument();
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();
  });
});
