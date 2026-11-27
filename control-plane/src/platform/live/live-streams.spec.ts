import type { MessageEvent } from '@nestjs/common';
import type { SequencedNotice } from '@platform/live/change-notices';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import type { LiveChannel } from '@platform/live/live-feed.port';
import type {
  ChannelLog,
  LiveNoticeLogPort,
  LivePositions,
} from '@platform/live/live-notice-log.port';
import {
  HANDOVER_MS,
  KEEPALIVE_MS,
  LIFETIME_MS,
  LIFETIME_SPREAD_MS,
  LiveStreams,
} from '@platform/live/live-streams';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CHANNELS: readonly LiveChannel[] = ['workspace:ws_1', 'person:user_1'];

const logged = (
  kept: readonly SequencedNotice[],
  heads: Partial<Record<LiveChannel, number>> = {},
): LiveNoticeLogPort => ({
  append: async () => [],
  logs: async (channels, since) =>
    new Map<LiveChannel, ChannelLog>(
      channels.map((channel) => [
        channel,
        {
          head: heads[channel] ?? 0,
          after: kept.filter(
            (notice) =>
              notice.channel === channel &&
              (notice.sequence ?? 0) > (since.get(channel) ?? 0),
          ),
        },
      ]),
    ),
  prune: async () => 0,
});

const failing: LiveNoticeLogPort = {
  append: async () => [],
  logs: async () => {
    throw new Error('database gone');
  },
  prune: async () => 0,
};

const logger = partial<LoggerPort>({ warn: vi.fn() });

const watching = ({
  random = 0,
  log = logged([]),
  since = new Map(),
}: {
  readonly random?: number;
  readonly log?: LiveNoticeLogPort;
  readonly since?: LivePositions;
} = {}) => {
  const feed = new InMemoryLiveFeed();
  const streams = new LiveStreams(feed, log, () => random, logger);
  const heard: MessageEvent[] = [];
  let ended = false;
  const subscription = streams.open(CHANNELS, since).subscribe({
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

const changed = (channel: LiveChannel, sequence: number) => ({
  type: 'changed',
  data: { topic: 'task', ids: {}, channel, sequence },
});

const settled = () => vi.advanceTimersByTimeAsync(0);

describe('LiveStreams', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says it is ready, then passes on what its channels hear', async () => {
    const { feed, heard } = watching();
    await settled();

    feed.publish('workspace:ws_1', {
      type: 'changed',
      data: { topic: 'chat' },
    });
    feed.publish('workspace:ws_2', {
      type: 'changed',
      data: { topic: 'task' },
    });

    expect(heard).toEqual([
      {
        type: 'ready',
        data: {
          complete: false,
          heads: { 'workspace:ws_1': 0, 'person:user_1': 0 },
        },
        retry: 1_000,
      },
      { type: 'changed', data: { topic: 'chat' } },
    ]);
  });

  it('sends again the changes missed since the given sequences, then says it is ready and complete', async () => {
    const { heard } = watching({
      log: logged(
        [
          {
            channel: 'workspace:ws_1',
            topic: 'task',
            ids: {},
            sequence: 4,
          },
          {
            channel: 'workspace:ws_1',
            topic: 'task',
            ids: {},
            sequence: 5,
          },
        ],
        { 'workspace:ws_1': 5, 'person:user_1': 2 },
      ),
      since: new Map([
        ['workspace:ws_1', 3],
        ['person:user_1', 2],
      ]),
    });
    await settled();

    expect(heard).toEqual([
      changed('workspace:ws_1', 4),
      changed('workspace:ws_1', 5),
      {
        type: 'ready',
        data: {
          complete: true,
          heads: { 'workspace:ws_1': 5, 'person:user_1': 2 },
        },
        retry: 1_000,
      },
    ]);
  });

  it('says it is not complete when the log no longer holds every missed change', async () => {
    const { heard } = watching({
      log: logged(
        [
          {
            channel: 'workspace:ws_1',
            topic: 'task',
            ids: {},
            sequence: 5,
          },
        ],
        { 'workspace:ws_1': 5, 'person:user_1': 0 },
      ),
      since: new Map([
        ['workspace:ws_1', 3],
        ['person:user_1', 0],
      ]),
    });
    await settled();

    expect(heard).toEqual([
      {
        type: 'ready',
        data: {
          complete: false,
          heads: { 'workspace:ws_1': 5, 'person:user_1': 0 },
        },
        retry: 1_000,
      },
    ]);
  });

  it('holds changes heard while it replays, and drops the ones it already sent again', async () => {
    const { feed, heard } = watching({
      log: logged(
        [
          {
            channel: 'workspace:ws_1',
            topic: 'task',
            ids: {},
            sequence: 2,
          },
        ],
        { 'workspace:ws_1': 2, 'person:user_1': 0 },
      ),
      since: new Map([
        ['workspace:ws_1', 1],
        ['person:user_1', 0],
      ]),
    });

    feed.publish('workspace:ws_1', changed('workspace:ws_1', 2));
    feed.publish('workspace:ws_1', changed('workspace:ws_1', 3));
    await settled();

    expect(heard.map((each) => [each.type, each.data])).toEqual([
      ['changed', changed('workspace:ws_1', 2).data],
      [
        'ready',
        {
          complete: true,
          heads: { 'workspace:ws_1': 2, 'person:user_1': 0 },
        },
      ],
      ['changed', changed('workspace:ws_1', 3).data],
    ]);
  });

  it('says it is ready but not complete when it cannot read the log', async () => {
    const { heard } = watching({
      log: failing,
      since: new Map([['workspace:ws_1', 3]]),
    });
    await settled();

    expect(heard).toEqual([
      {
        type: 'ready',
        data: { complete: false, heads: {} },
        retry: 1_000,
      },
    ]);
  });

  it('keeps the connection alive while nothing changes', async () => {
    const { heard } = watching();
    await settled();

    vi.advanceTimersByTime(KEEPALIVE_MS);

    expect(heard[heard.length - 1]?.type).toBe('keepalive');
  });

  it('asks for a new stream after its lifetime, spread so streams do not all end together, and keeps passing changes on until it ends', async () => {
    const { ended, feed, heard } = watching({ random: 0.5 });
    await settled();

    vi.advanceTimersByTime(LIFETIME_MS + LIFETIME_SPREAD_MS / 2 - 1);
    expect(heard.some((each) => each.type === 'reopen')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(heard).toContainEqual({ type: 'reopen', data: {} });

    feed.publish('workspace:ws_1', { type: 'changed', data: {} });
    expect(heard[heard.length - 1]?.type).toBe('changed');

    vi.advanceTimersByTime(HANDOVER_MS - 1);
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

  it('stops listening when the client goes away', async () => {
    const { feed, heard, subscription } = watching();
    await settled();

    subscription.unsubscribe();
    feed.publish('workspace:ws_1', { type: 'changed', data: {} });

    expect(heard).toHaveLength(1);
  });
});
