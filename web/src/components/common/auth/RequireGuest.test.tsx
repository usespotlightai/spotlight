import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireGuest } from '@/components/common/auth/RequireGuest';
import { useSession } from '@/hooks/api/useSession';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));

const mockSession = vi.mocked(useSession);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<p>login screen</p>} />
          <Route path="/signup" element={<p>signup screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSession.mockReset();
});

describe('RequireGuest', () => {
  it('shows the login screen when signed out', () => {
    mockSession.mockReturnValue({ data: null, isPending: false } as never);

    renderAt('/login');

    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('redirects away from login when already signed in', () => {
    mockSession.mockReturnValue({
      data: { user: { email: 'dev@example.com' } },
      isPending: false,
    } as never);

    renderAt('/login');

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });

  it('redirects away from signup when already signed in', () => {
    mockSession.mockReturnValue({
      data: { user: { email: 'dev@example.com' } },
      isPending: false,
    } as never);

    renderAt('/signup');

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('signup screen')).not.toBeInTheDocument();
  });

  it('renders nothing while the session is resolving', () => {
    mockSession.mockReturnValue({ data: null, isPending: true } as never);

    renderAt('/login');

    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
    expect(screen.queryByText('home')).not.toBeInTheDocument();
  });
});
