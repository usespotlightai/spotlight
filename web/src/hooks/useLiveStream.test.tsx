import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInboxNotifier } from '@/hooks/useInboxNotifier';
import {
  GAP_WAIT_MS,
  queriesTouchedBy,
  READY_WAIT_MS,
  REOPEN_MS,
  useLiveStream,
} from '@/hooks/useLiveStream';
import { isLive, LIVE_BATCH_MS, liveStaleTime, STALE_MS } from '@/lib/live';
import { LIVE_SEQUENCES_KEY } from '@/lib/live-sequences';

type Listener = (event: { data: string }) => void;

const streams: Stream[] = [];

class Stream {
  static readonly CLOSED = 2;
  readonly listeners = new Map<string, Listener>();
  readonly url: string;
  readyState = 0;
  closed = false;

  constructor(url: string) {
    this.url = url;
    streams.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  close() {
    this.closed = true;
    this.readyState = Stream.CLOSED;
  }

  send(type: string, data: object = {}) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) });
  }
}

const NOTIFICATION = {
  id: 'task_1:0',
  kind: 'task',
  title: 'Which database?',
  body: 'Postgres or SQLite for the cache?',
  path: '/w/acme/inbox/task_1%3A0',
  at: '2026-11-08T09:00:00.000Z',
};

const wrapperOf =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

const HEADS = { 'workspace:ws_1': 4, 'person:user_1': 2 };

const READY = { complete: false, heads: HEADS };

const CAUGHT_UP = { complete: true, heads: HEADS };

const task = (sequence: number) => ({
  topic: 'task',
  ids: { taskId: 'task_1' },
  channel: 'workspace:ws_1',
  sequence,
});

const settled = () => act(() => vi.advanceTimersByTimeAsync(0));

const watching = (stored?: Record<string, number>) => {
  const client = new QueryClient();

  if (stored) {
    client.setQueryData(LIVE_SEQUENCES_KEY, stored);
  }

  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const view = renderHook(() => useLiveStream(useInboxNotifier()), {
    wrapper: wrapperOf(client),
  });

  return { client, invalidated, view, stream: streams[0] };
};

describe('useLiveStream', () => {
  const shown = vi.fn();

  beforeEach(() => {
    streams.length = 0;
    shown.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', Stream);
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function (this: object, title: string, options: object) {
          shown(title, options);
        },
        { permission: 'granted' },
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens one stream and is live once it is ready', () => {
    const { stream } = watching();

    expect(stream.url).toBe('/api/me/live');
    expect(isLive()).toBe(false);

    act(() => stream.send('ready'));

    expect(isLive()).toBe(true);
  });

  it('refreshes the pages it keeps live once it is first ready', () => {
    const { invalidated, stream } = watching();

    act(() => stream.send('ready'));

    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['chat'] }],
      [{ queryKey: ['chats'] }],
      [{ queryKey: ['tasks'] }],
      [{ queryKey: ['inbox'] }],
      [{ queryKey: ['runs'] }],
    ]);
  });

  it('refreshes what a batch of changes touched, each query once', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready'));
    invalidated.mockClear();

    stream.send('changed', { topic: 'chat', ids: { chatId: 'chat_1' } });
    stream.send('changed', { topic: 'chat', ids: { chatId: 'chat_1' } });
    stream.send('changed', { topic: 'nonsense', ids: {} });

    expect(invalidated).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIVE_BATCH_MS);

    expect(invalidated.mock.calls.map(([filters]) => filters)).toEqual([
      { queryKey: ['chat', 'chat_1'] },
      { queryKey: ['chats'] },
      { queryKey: ['journal-runs', 'chat', 'chat_1'] },
    ]);
  });

  it('reopens itself from the sequences it applied when the stream drops, and fetches nothing again when the stream caught it up', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    act(() => stream.send('error'));
    expect(isLive()).toBe(false);
    expect(stream.closed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(REOPEN_MS);
    });

    const next = streams[1];
    expect(decodeURIComponent(next.url)).toBe(
      '/api/me/live?since=workspace:ws_1@4&since=person:user_1@2',
    );

    act(() => next.send('ready', CAUGHT_UP));

    expect(invalidated).not.toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('fetches everything again when the stream could not send every missed change', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    act(() => stream.send('reopen'));
    invalidated.mockClear();

    act(() => streams[1].send('ready', READY));

    expect(invalidated.mock.calls).toEqual([[]]);
  });

  it('opens a new stream from its sequences when some changes were not sent', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    act(() => stream.send('resync'));

    expect(streams).toHaveLength(2);
    expect(decodeURIComponent(streams[1].url)).toContain(
      'since=workspace:ws_1@4',
    );
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('refreshes a change once, even when it hears it again', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    stream.send('changed', task(5));
    vi.advanceTimersByTime(LIVE_BATCH_MS);
    invalidated.mockClear();

    stream.send('changed', task(5));
    stream.send('changed', task(4));
    vi.advanceTimersByTime(LIVE_BATCH_MS);

    expect(invalidated).not.toHaveBeenCalled();
  });

  it('opens a new stream when a gap in the sequences stays open', () => {
    const { stream } = watching();
    act(() => stream.send('ready', READY));

    act(() => stream.send('changed', task(6)));
    act(() => {
      vi.advanceTimersByTime(GAP_WAIT_MS - 1);
    });
    expect(streams).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(streams).toHaveLength(2);
    expect(decodeURIComponent(streams[1].url)).toContain(
      'since=workspace:ws_1@4',
    );
  });

  it('drops a new stream that does not answer in time, and keeps the old one', () => {
    const { stream } = watching();
    act(() => stream.send('ready', READY));
    act(() => stream.send('reopen'));

    act(() => {
      vi.advanceTimersByTime(READY_WAIT_MS);
    });

    expect(streams[1].closed).toBe(true);
    expect(stream.closed).toBe(false);
  });

  it('opens no new stream when the missing change arrives in time', () => {
    const { stream } = watching();
    act(() => stream.send('ready', READY));

    act(() => stream.send('changed', task(6)));
    act(() => stream.send('changed', task(5)));
    act(() => {
      vi.advanceTimersByTime(GAP_WAIT_MS);
    });

    expect(streams).toHaveLength(1);
  });

  it('keeps the sequences it refreshed with the cache', async () => {
    const { client, stream } = watching();
    act(() => stream.send('ready', READY));
    await settled();

    stream.send('changed', task(5));
    act(() => {
      vi.advanceTimersByTime(LIVE_BATCH_MS);
    });
    await settled();

    expect(client.getQueryData(LIVE_SEQUENCES_KEY)).toEqual({
      'workspace:ws_1': 5,
      'person:user_1': 2,
    });
  });

  it('resumes from the sequences kept with the cache, and keeps cached pages fresh until the stream answers', () => {
    const { invalidated, stream } = watching({ 'workspace:ws_1': 3 });

    expect(decodeURIComponent(stream.url)).toBe(
      '/api/me/live?since=workspace:ws_1@3',
    );
    expect(liveStaleTime()).toBe(Infinity);

    act(() => stream.send('changed', task(4)));
    act(() => stream.send('ready', CAUGHT_UP));
    act(() => {
      vi.advanceTimersByTime(LIVE_BATCH_MS);
    });

    expect(invalidated.mock.calls.map(([filters]) => filters)).toContainEqual({
      queryKey: ['tasks'],
    });
    expect(invalidated).not.toHaveBeenCalledWith();
  });

  it('fetches everything again when the stream does not answer in time after a resume', () => {
    const { invalidated } = watching({ 'workspace:ws_1': 3 });

    act(() => {
      vi.advanceTimersByTime(READY_WAIT_MS);
    });

    expect(invalidated.mock.calls).toEqual([[]]);
    expect(liveStaleTime()).toBe(STALE_MS);
  });

  it('holds back a refresh while an optimistic change is on its way', async () => {
    const { client, invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    let finish = () => {};
    void client
      .getMutationCache()
      .build(client, {
        meta: { optimistic: true },
        mutationFn: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      })
      .execute(undefined);
    await settled();

    stream.send('changed', task(5));
    act(() => {
      vi.advanceTimersByTime(LIVE_BATCH_MS * 3);
    });
    expect(invalidated).not.toHaveBeenCalled();

    finish();
    await settled();
    await act(() => vi.advanceTimersByTimeAsync(LIVE_BATCH_MS));

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('opens a new stream after the old one closed for good', () => {
    const { stream } = watching();
    stream.readyState = Stream.CLOSED;

    act(() => stream.send('error'));
    expect(streams).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(REOPEN_MS);
    });

    expect(stream.closed).toBe(true);
    expect(streams).toHaveLength(2);
    expect(streams[1]?.url).toBe('/api/me/live');
  });

  it('hands over to a new stream when asked, with nothing fetched again', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    act(() => stream.send('reopen'));
    expect(streams).toHaveLength(2);
    expect(stream.closed).toBe(false);

    const next = streams[1];
    act(() => next.send('ready', CAUGHT_UP));

    expect(stream.closed).toBe(true);
    expect(next.closed).toBe(false);
    expect(invalidated).not.toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('watches a workspace the person joined with a new stream, then fetches everything', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    invalidated.mockClear();

    act(() =>
      stream.send('changed', {
        topic: 'workspaces',
        ids: { workspaceId: 'ws_2' },
      }),
    );
    expect(streams).toHaveLength(2);

    act(() => streams[1].send('ready', READY));

    expect(stream.closed).toBe(true);
    expect(invalidated.mock.calls).toEqual([[]]);
  });

  it('falls back to the new stream when the old one ends before the handover', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready', READY));
    act(() => stream.send('reopen'));
    invalidated.mockClear();

    stream.readyState = Stream.CLOSED;
    act(() => stream.send('error'));
    act(() => streams[1].send('ready', CAUGHT_UP));

    expect(streams).toHaveLength(2);
    expect(invalidated).not.toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('refreshes the inbox and shows the item when this browser has no Web Push', () => {
    const { invalidated, stream } = watching();

    stream.send('notification', NOTIFICATION);

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['inbox'] });
    expect(shown).toHaveBeenCalledWith('Which database?', {
      body: 'Postgres or SQLite for the cache?',
      tag: 'task_1:0',
    });
  });

  it('closes the stream and stops being live when it unmounts', () => {
    const { stream, view } = watching();
    act(() => stream.send('ready'));

    view.unmount();

    expect(stream.closed).toBe(true);
    expect(isLive()).toBe(false);
  });
});

describe('queriesTouchedBy', () => {
  it('refreshes the board, inbox and that task’s runs and moves for a task change', () => {
    expect(
      queriesTouchedBy({ topic: 'task', ids: { taskId: 'task_1' } }),
    ).toEqual([
      ['tasks'],
      ['inbox'],
      ['runs'],
      ['runs', 'task', 'task_1'],
      ['task-moves', 'task_1'],
      ['trace', 'task', 'task_1'],
      ['journal-runs', 'task', 'task_1'],
    ]);
  });

  it('refreshes run lists, the board and the chats for a run change', () => {
    expect(queriesTouchedBy({ topic: 'run', ids: { runId: 'run_1' } })).toEqual(
      [
        ['runs'],
        ['tasks'],
        ['chats'],
        ['chat'],
        ['inbox'],
        ['journal', 'run_1'],
      ],
    );
  });
});
