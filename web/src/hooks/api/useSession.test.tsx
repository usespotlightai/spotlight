import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '@/hooks/api/useSession';
import { authClient } from '@/lib/authClient';

vi.mock('@/lib/authClient', () => ({
  authClient: { getSession: vi.fn() },
}));

const read = vi.mocked(authClient.getSession);

let client = new QueryClient();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const sessionOf = async () => {
  const { result } = renderHook(() => useSession(), { wrapper });

  await waitFor(() => expect(result.current.isPending).toBe(false));

  return result.current;
};

describe('useSession', () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    read.mockReset();
  });

  it('keeps the person and leaves the session token out of the cache', async () => {
    read.mockResolvedValue({
      data: {
        user: {
          id: 'user_1',
          name: 'Sam Rivera',
          email: 'sam@example.com',
          image: null,
          emailVerified: true,
        },
        session: { id: 'session_1', token: 'secret', userId: 'user_1' },
      },
      error: null,
    });

    expect((await sessionOf()).data).toEqual({
      user: {
        id: 'user_1',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        image: null,
      },
    });
  });

  it('reads nobody when signed out', async () => {
    read.mockResolvedValue({ data: null, error: null });

    expect((await sessionOf()).data).toBeNull();
  });

  it('fails when the session cannot be read', async () => {
    read.mockResolvedValue({
      data: null,
      error: { message: 'down', status: 503 },
    });

    expect((await sessionOf()).error?.message).toBe('down');
  });
});
