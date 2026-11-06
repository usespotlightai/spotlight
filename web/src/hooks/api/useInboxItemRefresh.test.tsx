import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inboxKeys } from '@/hooks/api/useInbox';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import { journalKeys } from '@/hooks/api/useRunJournals';
import type { InboxItem } from '@/lib/inbox';

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

describe('a bump while the run is live', () => {
  beforeEach(() => {
    streams.length = 0;
    client = new QueryClient();
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the journal of the live run and not the whole task', () => {
    const invalidated = vi.spyOn(client, 'invalidateQueries');
    const item = {
      id: 'task_1:2',
      taskId: 'task_1',
      runId: 'run_1',
      progress: 'in-progress',
    } as unknown as InboxItem;

    renderHook(() => useInboxItemRefresh('acme', item), { wrapper });
    invalidated.mockClear();
    act(() => streams[0]?.onmessage?.());

    expect(
      invalidated.mock.calls.map(([filters]) => filters?.queryKey),
    ).toEqual([journalKeys.ofRun('run_1'), inboxKeys.item('acme', 'task_1:2')]);
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

  it('stays open in the inbox while its run has not ended', () => {
    const item = {
      taskId: 'task_1',
      runId: 'run_1',
      progress: null,
    } as unknown as InboxItem;

    renderHook(() => useInboxItemRefresh('acme', item), { wrapper });

    expect(opened).toEqual(['/api/runs/run_1/stream']);
  });
});
