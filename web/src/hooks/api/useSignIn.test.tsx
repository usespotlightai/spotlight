import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignIn } from '@/hooks/api/useSignIn';
import { authClient } from '@/lib/authClient';

vi.mock('@/lib/authClient', () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const signInEmail = vi.mocked(authClient.signIn.email);

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  signInEmail.mockReset();
});

describe('useSignIn', () => {
  it('returns the session on success', async () => {
    signInEmail.mockResolvedValue({
      data: { token: 'tok', user: { email: 'dev@example.com' } },
      error: null,
    } as never);

    const { result } = renderHook(() => useSignIn(), { wrapper });
    result.current.mutate({ email: 'dev@example.com', password: 'pw' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ token: 'tok' });
    expect(signInEmail).toHaveBeenCalledWith({
      email: 'dev@example.com',
      password: 'pw',
    });
  });

  it('turns an auth error into a rejected mutation', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password', status: 401 },
    } as never);

    const { result } = renderHook(() => useSignIn(), { wrapper });
    result.current.mutate({ email: 'dev@example.com', password: 'nope' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Invalid email or password');
  });
});
