import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRefresh } from '@/hooks/api/useChatRefresh';
import { chatKeys } from '@/hooks/api/useChats';
import { journalKeys } from '@/hooks/api/useRunJournals';
import type { Chat } from '@/lib/chat';

const opened: string[] = [];
const streams: Stream[] = [];

class Stream {
  onmessage: (() => void) | null = null;

  constructor(url: string) {
    opened.push(url);
    streams.push(this);
  }

  close() {}
}

let client = new QueryClient();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('a bump while the chat’s run is live', () => {
  beforeEach(() => {
    streams.length = 0;
    client = new QueryClient();
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the journal of the live run and the chat only', () => {
    const invalidated = vi.spyOn(client, 'invalidateQueries');
    const chat = {
      runId: 'run_1',
      progress: 'in-progress',
      messages: [],
    } as unknown as Chat;

    renderHook(() => useChatRefresh('chat_1', chat), { wrapper });
    invalidated.mockClear();
    act(() => streams[0]?.onmessage?.());

    expect(
      invalidated.mock.calls.map(([filters]) => filters?.queryKey),
    ).toEqual([journalKeys.ofRun('run_1'), chatKeys.one('chat_1')]);
  });
});

describe('the stream of a run that is stopping', () => {
  beforeEach(() => {
    opened.length = 0;
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays open in a chat while its run has not ended', () => {
    const chat = {
      runId: 'run_1',
      progress: null,
      messages: [],
    } as unknown as Chat;

    renderHook(() => useChatRefresh('chat_1', chat), { wrapper });

    expect(opened).toEqual(['/api/runs/run_1/stream']);
  });
});
