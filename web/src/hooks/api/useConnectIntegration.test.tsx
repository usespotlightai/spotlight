import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';

const connectIntegration = vi.fn<(...args: unknown[]) => unknown>();
const authorize = vi.fn();

vi.mock('@/lib/api', () => ({
  connectIntegration: (options: unknown) => connectIntegration(options),
}));

vi.mock('@/lib/desktop', () => ({
  desktopApp: () => ({ authorize }),
}));

const connecting = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useConnectIntegration('team_1'), { wrapper }).result;
};

describe('useConnectIntegration', () => {
  beforeEach(() => {
    connectIntegration.mockReset();
    authorize.mockReset();
  });

  it('opens the authorize URL Spotlight answered with', async () => {
    connectIntegration.mockResolvedValue({
      data: { url: 'https://linear.app/oauth/authorize?state=s' },
    });
    const result = connecting();

    act(() => result.current.mutate({ integration: 'linear' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authorize).toHaveBeenCalledWith(
      'https://linear.app/oauth/authorize?state=s',
    );
  });

  it('fails with the reason Spotlight gave', async () => {
    connectIntegration.mockResolvedValue({
      error: {
        statusCode: 422,
        message:
          'Integration linear has no OAuth2 client. Required: an OAUTH_CLIENTS entry for linear',
      },
    });
    const result = connecting();

    act(() => result.current.mutate({ integration: 'linear' }));

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        'Integration linear has no OAuth2 client. Required: an OAUTH_CLIENTS entry for linear',
      ),
    );
    expect(authorize).not.toHaveBeenCalled();
  });

  it('asks to try again where Spotlight gave no reason', async () => {
    connectIntegration.mockResolvedValue({ error: {} });
    const result = connecting();

    act(() => result.current.mutate({ integration: 'linear' }));

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        'Sorry, the account couldn’t be connected. Please try again.',
      ),
    );
  });
});
