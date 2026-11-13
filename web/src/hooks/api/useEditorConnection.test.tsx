import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorConnection } from '@/hooks/api/useEditorConnection';

const readEditorConnection = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('@/lib/api', () => ({
  readEditorConnection: (options: unknown) => readEditorConnection(options),
}));

const chat = { kind: 'chat', id: 'chat_1' } as const;

const watching = (since: number | null) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useEditorConnection(chat, 'acme', since), {
    wrapper,
  }).result;
};

describe('useEditorConnection', () => {
  beforeEach(() => {
    readEditorConnection.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it('asks nothing before a launch', () => {
    watching(null);

    expect(readEditorConnection).not.toHaveBeenCalled();
  });

  it('asks every 2 seconds until an editor holds the sandbox, then stops', async () => {
    readEditorConnection
      .mockResolvedValueOnce({ data: { connected: false } })
      .mockResolvedValue({ data: { connected: true } });
    const result = watching(1);

    await waitFor(() => expect(result.current.data).toBe(false));
    expect(readEditorConnection).toHaveBeenCalledWith({
      query: { chat: 'chat_1', workspace: 'acme' },
      throwOnError: true,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    await waitFor(() => expect(result.current.data).toBe(true));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(readEditorConnection).toHaveBeenCalledTimes(2);
  });

  it('stops asking after an error', async () => {
    readEditorConnection.mockRejectedValue(new Error('404 Not Found'));
    const result = watching(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(readEditorConnection).toHaveBeenCalledTimes(1);
  });
});
