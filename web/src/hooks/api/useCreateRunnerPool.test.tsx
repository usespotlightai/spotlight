import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateRunnerPool } from '@/hooks/api/useCreateRunnerPool';
import { FieldRefusal } from '@/lib/error';

const createRunnerPool = vi.fn<(...args: unknown[]) => unknown>();

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
    const anyKey: unknown = expect.any(String);
    expect(createRunnerPool).toHaveBeenCalledWith({
      path: { workspaceId: 'workspace_acme' },
      headers: { 'Idempotency-Key': anyKey },
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

  it('says why Spotlight refused the name, without naming the field', async () => {
    const advice =
      'Use lowercase letters and digits, with single dashes between words, such as dev-host (at most 64 characters).';
    createRunnerPool.mockResolvedValue(
      answered(422, {
        detail: `key: ${advice}`,
        errors: [{ path: 'key', message: advice, severity: 'error' }],
      }),
    );
    const result = creating();

    act(() => result.current.mutate('Dev Host'));

    await waitFor(() => expect(result.current.error?.message).toBe(advice));
    expect(result.current.error).toBeInstanceOf(FieldRefusal);
    expect(result.current.error).toHaveProperty('field', 'key');
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
