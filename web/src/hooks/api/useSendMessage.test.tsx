import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useMessagesInFlight,
  useSendMessage,
} from '@/hooks/api/useSendMessage';

const sendMessage = vi.fn();

vi.mock('@/lib/api', () => ({
  sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

const setUp = (runIds: readonly string[]) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(
    () => ({ send: useSendMessage(), inFlight: useMessagesInFlight(runIds) }),
    { wrapper },
  ).result;
};

const message = {
  teamId: 'team_1',
  runId: 'run_2',
  body: 'try again',
  attachments: [],
  startsWork: true,
};

describe('useMessagesInFlight', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it('holds a message while the server has not taken it yet', async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const result = setUp(['run_1', 'run_2']);

    act(() => result.current.send.mutate(message));

    await waitFor(() =>
      expect(result.current.inFlight).toEqual([
        { ...message, sentAt: expect.any(Number) },
      ]),
    );
  });

  it('lets go of a message that the server refused', async () => {
    sendMessage.mockRejectedValue(new Error('refused'));
    const result = setUp(['run_2']);

    act(() => result.current.send.mutate(message));

    await waitFor(() => expect(result.current.send.isError).toBe(true));
    expect(result.current.inFlight).toEqual([]);
  });

  it('leaves out the messages to other runs', async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const result = setUp(['run_1']);

    act(() => result.current.send.mutate(message));

    await waitFor(() => expect(result.current.send.isPending).toBe(true));
    expect(result.current.inFlight).toEqual([]);
  });
});
