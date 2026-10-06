import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateRunnerPool } from '@/hooks/api/useCreateRunnerPool';

const createRunnerPool = vi.fn();

vi.mock('@/lib/api', () => ({
  createRunnerPool: (options: unknown) => createRunnerPool(options),
}));

const answered = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => ({
  ...(status < 300 ? { data: body } : { error: body }),
  response: new Response(null, { status, headers }),
});

const creating = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useCreateRunnerPool('workspace_acme'), { wrapper })
    .result;
};

describe('useCreateRunnerPool', () => {
  beforeEach(() => createRunnerPool.mockReset());

  it('creates a pull pool once, and hands back the token Spotlight answered with', async () => {
    createRunnerPool.mockResolvedValue(
      answered(
        201,
        { key: 'my-computer' },
        { 'Spotlight-Pool-Token': 'spt_pool_secret' },
      ),
    );
    const result = creating();

    act(() => result.current.mutate('my-computer'));

    await waitFor(() =>
      expect(result.current.data).toEqual({
        key: 'my-computer',
        token: 'spt_pool_secret',
      }),
    );
    expect(createRunnerPool).toHaveBeenCalledWith({
      path: { workspaceId: 'workspace_acme' },
      headers: { 'Idempotency-Key': expect.any(String) },
      body: { key: 'my-computer' },
    });
  });

  it('says a taken name is taken, naming the pool', async () => {
    createRunnerPool.mockResolvedValue(
      answered(409, {
        detail:
          'There is already a runner-pool at my-computer; import it rather than creating it',
      }),
    );
    const result = creating();

    act(() => result.current.mutate('my-computer'));

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        'Pool my-computer already exists. Please choose another name.',
      ),
    );
  });

  it('fails when Spotlight answers no token', async () => {
    createRunnerPool.mockResolvedValue(answered(201, { key: 'my-computer' }));
    const result = creating();

    act(() => result.current.mutate('my-computer'));

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        'Sorry, the pool couldn’t be created.',
      ),
    );
  });
});
