import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useConnectGitHubInstallation } from '@/hooks/api/useConnectGitHubInstallation';
import { gitHubKeys } from '@/hooks/api/useGitHub';

const connectGitHub = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('@/lib/api', () => ({
  connectGitHub: (options: unknown) => connectGitHub(options),
}));

describe('useConnectGitHubInstallation', () => {
  it('reads the installations again where another workspace took one first', async () => {
    connectGitHub.mockRejectedValue({
      statusCode: 409,
      message: 'Another workspace already uses this GitHub installation.',
    });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConnectGitHubInstallation('acme'), {
      wrapper,
    });

    act(() => result.current.mutate('42'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: gitHubKeys.installations('acme'),
    });
  });
});
