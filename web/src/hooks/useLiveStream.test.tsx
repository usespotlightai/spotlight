import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInboxNotifier } from '@/hooks/useInboxNotifier';
import {
  queriesTouchedBy,
  REOPEN_MS,
  useLiveStream,
} from '@/hooks/useLiveStream';
import { isLive, LIVE_BATCH_MS } from '@/lib/live';

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

const watching = () => {
  const client = new QueryClient();
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const view = renderHook(() => useLiveStream(useInboxNotifier()), {
    wrapper: wrapperOf(client),
  });

  return { invalidated, view, stream: streams[0] as Stream };
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

  it('fetches everything again after it reconnects or misses changes', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready'));
    invalidated.mockClear();

    act(() => stream.send('error'));
    expect(isLive()).toBe(false);

    act(() => stream.send('ready'));
    stream.send('resync');

    expect(invalidated.mock.calls).toEqual([[], []]);
  });

  it('opens a new stream after the old one closed for good', () => {
    const { stream } = watching();
    stream.readyState = Stream.CLOSED;

    act(() => stream.send('error'));
    expect(streams).toHaveLength(1);

    act(() => vi.advanceTimersByTime(REOPEN_MS));

    expect(stream.closed).toBe(true);
    expect(streams).toHaveLength(2);
    expect(streams[1]?.url).toBe('/api/me/live');
  });

  it('hands over to a new stream when asked, with nothing fetched again', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready'));
    invalidated.mockClear();

    act(() => stream.send('reopen'));
    expect(streams).toHaveLength(2);
    expect(stream.closed).toBe(false);

    const next = streams[1] as Stream;
    act(() => next.send('ready'));

    expect(stream.closed).toBe(true);
    expect(next.closed).toBe(false);
    expect(invalidated).not.toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('watches a workspace the person joined with a new stream, then fetches everything', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready'));
    invalidated.mockClear();

    act(() =>
      stream.send('changed', {
        topic: 'workspaces',
        ids: { workspaceId: 'ws_2' },
      }),
    );
    expect(streams).toHaveLength(2);

    act(() => (streams[1] as Stream).send('ready'));

    expect(stream.closed).toBe(true);
    expect(invalidated.mock.calls).toEqual([[]]);
  });

  it('falls back to the new stream when the old one ends before the handover', () => {
    const { invalidated, stream } = watching();
    act(() => stream.send('ready'));
    act(() => stream.send('reopen'));
    invalidated.mockClear();

    stream.readyState = Stream.CLOSED;
    act(() => stream.send('error'));
    act(() => (streams[1] as Stream).send('ready'));

    expect(streams).toHaveLength(2);
    expect(invalidated.mock.calls).toEqual([[]]);
  });

  it('refreshes the inbox and shows the item when this browser has no Web Push', () => {
    const { invalidated, stream } = watching();

    stream.send('notification', NOTIFICATION);

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['inbox'] });
    expect(shown).toHaveBeenCalledWith('Which database?', {
      body: 'Postgres or SQLite for the cache?',
      tag: 'task_1:0',
      icon: '/email-logo.png',
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
  it('refreshes the board, inbox and that task’s runs for a task change', () => {
    expect(
      queriesTouchedBy({ topic: 'task', ids: { taskId: 'task_1' } }),
    ).toEqual([
      ['tasks'],
      ['inbox'],
      ['runs'],
      ['runs', 'task', 'task_1'],
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
