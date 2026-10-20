import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { useSendMessage } from '@/hooks/api/useSendMessage';
import type { RunNotes } from '@/lib/run-notes';

const sendMessage = vi.fn();

vi.mock('@/lib/api', () => ({
  sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

const STATION = {
  id: 'station_3',
  name: 'Implementation',
  color: '#5c66d9',
  position: 2,
  count: 4,
};

const notesOf = (over: Partial<RunNotes> = {}): RunNotes =>
  ({
    runId: 'run_1',
    taskId: 'task_1',
    station: STATION,
    working: false,
    notes: [{ position: 0, body: 'The tests failed.' }],
    ...over,
  }) as RunNotes;

const SAM = { id: 'user_1', name: 'Sam', image: null };

const setUp = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(runNotesKeys.forRun('run_1'), notesOf());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSendMessage(), { wrapper });

  return { client, result };
};

const send = {
  teamId: 'team_1',
  runId: 'run_1',
  body: 'try again',
  attachments: [],
  shown: {
    taskId: 'task_1',
    stationId: 'station_3',
    author: SAM,
    startsRun: true,
  },
};

describe('useSendMessage', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it('shows the message in the thread before the server answers', async () => {
    sendMessage.mockReturnValue(new Promise(() => {}));
    const { client, result } = setUp();

    act(() => result.current.mutate(send));

    await waitFor(() => {
      const shown = client.getQueryData<RunNotes>(runNotesKeys.forRun('run_1'));
      expect(shown?.notes.at(-1)).toMatchObject({
        position: 1,
        voice: 'person',
        body: 'try again',
        author: SAM,
      });
      expect(shown?.working).toBe(true);
    });
  });

  it('takes the message back when the server refuses it', async () => {
    sendMessage.mockRejectedValue(new Error('refused'));
    const { client, result } = setUp();

    act(() => result.current.mutate(send));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      client.getQueryData<RunNotes>(runNotesKeys.forRun('run_1'))?.notes,
    ).toHaveLength(1);
  });
});
