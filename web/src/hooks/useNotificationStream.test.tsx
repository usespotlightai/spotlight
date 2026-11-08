import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStream } from '@/hooks/useNotificationStream';

type Listener = (event: { data: string }) => void;

const streams: Stream[] = [];

class Stream {
  readonly listeners = new Map<string, Listener>();
  readonly url: string;
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
  }

  send(notification: object) {
    this.listeners.get('notification')?.({
      data: JSON.stringify(notification),
    });
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

describe('useNotificationStream', () => {
  const shown = vi.fn();

  beforeEach(() => {
    streams.length = 0;
    shown.mockClear();
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
    vi.unstubAllGlobals();
  });

  it('refreshes the inbox and shows the item when this browser has no Web Push', async () => {
    const client = new QueryClient();
    const invalidated = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useNotificationStream(), { wrapper: wrapperOf(client) });

    streams[0]?.send(NOTIFICATION);

    expect(streams[0]?.url).toBe('/api/me/notifications/stream');
    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['inbox'] });
    expect(shown).toHaveBeenCalledWith('Which database?', {
      body: 'Postgres or SQLite for the cache?',
      tag: 'task_1:0',
      icon: '/email-logo.png',
    });
  });

  it('closes the stream when it unmounts', () => {
    const { unmount } = renderHook(() => useNotificationStream(), {
      wrapper: wrapperOf(new QueryClient()),
    });

    unmount();

    expect(streams[0]?.closed).toBe(true);
  });
});
