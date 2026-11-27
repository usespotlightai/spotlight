import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireGuest } from '@/components/shell/auth/RequireGuest';
import { type SessionUser, useSession } from '@/hooks/api/useSession';
import { partial } from '@/test/partial';

type SessionState = ReturnType<typeof useSession>;

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));

const mockSession = vi.mocked(useSession);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<p>login screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSession.mockReset();
});

describe('RequireGuest', () => {
  it('shows the login screen when signed out', () => {
    mockSession.mockReturnValue(
      partial<SessionState>({ data: null, isPending: false }),
    );

    renderAt('/login');

    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('redirects away from login when already signed in', () => {
    mockSession.mockReturnValue(
      partial<SessionState>({
        data: { user: partial<SessionUser>({ email: 'dev@example.com' }) },
        isPending: false,
      }),
    );

    renderAt('/login');

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });

  it('renders nothing while the session is resolving', () => {
    mockSession.mockReturnValue(
      partial<SessionState>({ data: undefined, isPending: true }),
    );

    renderAt('/login');

    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
    expect(screen.queryByText('home')).not.toBeInTheDocument();
  });
});
