import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runNotesKeys } from '@/hooks/api/useRunNotes';
import {
  useMessagesInFlight,
  useSendMessage,
} from '@/hooks/api/useSendMessage';

const sendMessage = vi.fn<(...args: unknown[]) => unknown>();

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
  files: [],
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
        { ...message, sentAt: expect.any(Number) as number },
      ]),
    );
  });

  it('holds the files of a message with the message', async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const result = setUp(['run_2']);
    const files = [
      { id: 'att_1', name: 'log.txt', contentType: 'text/plain', size: 12 },
    ];

    act(() => result.current.send.mutate({ ...message, files }));

    await waitFor(() =>
      expect(result.current.inFlight[0]?.files).toEqual(files),
    );
  });

  it('keeps a message the server took, and does not wait for the notes to load again', async () => {
    sendMessage.mockResolvedValue({});
    let loads = 0;
    let finish: () => void = () => {};
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        notes: useQuery({
          queryKey: [...runNotesKeys.all, 'run_2'],
          queryFn: () => {
            loads += 1;

            return loads === 1
              ? null
              : new Promise<null>((resolve) => {
                  finish = () => resolve(null);
                });
          },
        }),
        send: useSendMessage(),
        inFlight: useMessagesInFlight(['run_2']),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    act(() => result.current.send.mutate(message));

    await waitFor(() => expect(result.current.send.isSuccess).toBe(true));
    expect(result.current.notes.isFetching).toBe(true);
    expect(result.current.inFlight).toHaveLength(1);
    act(() => finish());
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
