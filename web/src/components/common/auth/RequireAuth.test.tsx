import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/common/auth/RequireAuth';
import { useSession } from '@/hooks/api/useSession';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));

const mockSession = vi.mocked(useSession);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>login screen</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>protected page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSession.mockReset();
});

describe('RequireAuth', () => {
  it('renders the page when a session exists', () => {
    mockSession.mockReturnValue({
      data: { user: { email: 'dev@example.com' } },
      isPending: false,
    } as never);

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
});
