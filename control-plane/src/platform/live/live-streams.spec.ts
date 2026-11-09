import type { MessageEvent } from '@nestjs/common';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import {
  KEEPALIVE_MS,
  LIFETIME_MS,
  LIFETIME_SPREAD_MS,
  LiveStreams,
} from '@platform/live/live-streams';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const watching = (random = 0) => {
  const feed = new InMemoryLiveFeed();
  const streams = new LiveStreams(feed, () => random);
  const heard: MessageEvent[] = [];
  let ended = false;
  const subscription = streams
    .open(['workspace:ws_1', 'person:user_1'])
    .subscribe({
      next: (event) => heard.push(event),
      complete: () => {
        ended = true;
      },
    });

  return {
    feed,
    streams,
    heard,
    subscription,
    ended: () => ended,
  };
};

describe('LiveStreams', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says it is ready, then passes on what its channels hear', () => {
    const { feed, heard } = watching();

    feed.publish('workspace:ws_1', {
      type: 'changed',
      data: { topic: 'chat' },
    });
    feed.publish('workspace:ws_2', {
      type: 'changed',
      data: { topic: 'task' },
    });

    expect(heard).toEqual([
      { type: 'ready', data: {}, retry: 1_000 },
      { type: 'changed', data: { topic: 'chat' } },
    ]);
  });

  it('keeps the connection alive while nothing changes', () => {
    const { heard } = watching();

    vi.advanceTimersByTime(KEEPALIVE_MS);

    expect(heard[heard.length - 1]?.type).toBe('keepalive');
  });

  it('ends after its lifetime, spread so streams do not all end together', () => {
    const { ended, feed, heard } = watching(0.5);

    vi.advanceTimersByTime(LIFETIME_MS + LIFETIME_SPREAD_MS / 2 - 1);
    expect(ended()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(ended()).toBe(true);

    const count = heard.length;
    feed.publish('workspace:ws_1', { type: 'changed', data: {} });
    expect(heard).toHaveLength(count);
  });

  it('ends every open stream when the instance shuts down', () => {
    const { ended, streams } = watching();

    streams.beforeApplicationShutdown();

    expect(ended()).toBe(true);
  });

  it('stops listening when the client goes away', () => {
    const { feed, heard, subscription } = watching();

    subscription.unsubscribe();
    feed.publish('workspace:ws_1', { type: 'changed', data: {} });

    expect(heard).toHaveLength(1);
  });
});
