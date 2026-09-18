import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignIn } from '@/hooks/api/useSignIn';
import { authClient } from '@/lib/authClient';

vi.mock('@/lib/authClient', () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

const signInSocial = vi.mocked(authClient.signIn.social);

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  signInSocial.mockReset();
});

describe('useSignIn', () => {
  it('hands the browser to GitHub, and back to where the app starts', async () => {
    signInSocial.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize', redirect: true },
      error: null,
    } as never);

    const { result } = renderHook(() => useSignIn(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: '/',
    });
  });

  it('hands the browser back to where it was sent from, where it was', async () => {
    signInSocial.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize', redirect: true },
      error: null,
    } as never);

    const { result } = renderHook(() => useSignIn('/invites/tok-123'), {
      wrapper,
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: '/invites/tok-123',
    });
  });

  it('turns an auth error into a rejected mutation', async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: { message: 'GitHub is not reachable', status: 502 },
    } as never);

    const { result } = renderHook(() => useSignIn(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('GitHub is not reachable');
  });
});
