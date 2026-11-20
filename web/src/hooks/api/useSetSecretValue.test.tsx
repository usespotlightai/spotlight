import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSetSecretValue } from '@/hooks/api/useSetSecretValue';
import { secretKeys } from '@/hooks/api/useWorkspaceSecrets';

const setWorkspaceSecretValue = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('@/lib/api', () => ({
  setWorkspaceSecretValue: (options: unknown) =>
    setWorkspaceSecretValue(options),
}));

const setting = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    result: renderHook(() => useSetSecretValue('acme'), { wrapper }).result,
    invalidated,
  };
};

describe('useSetSecretValue', () => {
  beforeEach(() => {
    setWorkspaceSecretValue.mockReset();
  });

  it('sends the value of the named secret, and lists the secrets anew', async () => {
    setWorkspaceSecretValue.mockResolvedValue({});
    const { result, invalidated } = setting();

    act(() =>
      result.current.mutate({ name: 'SENTRY_TOKEN', value: 'sntrys_1' }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setWorkspaceSecretValue).toHaveBeenCalledWith({
      path: { slug: 'acme', name: 'SENTRY_TOKEN' },
      body: { value: 'sntrys_1' },
      throwOnError: true,
    });
    expect(invalidated).toHaveBeenCalledWith({
      queryKey: secretKeys.forWorkspace('acme'),
    });
  });

  it('lists the secrets anew when Terraform sets the value', async () => {
    setWorkspaceSecretValue.mockRejectedValue(
      new Error('Terraform sets the value of secret SENTRY_TOKEN'),
    );
    const { result, invalidated } = setting();

    act(() =>
      result.current.mutate({ name: 'SENTRY_TOKEN', value: 'sntrys_1' }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated).toHaveBeenCalled();
  });
});
