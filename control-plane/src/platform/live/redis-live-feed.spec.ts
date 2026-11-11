import type { LiveMessage } from '@platform/live/live-feed.port';
import { RedisLiveFeed } from '@platform/live/redis-live-feed';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import RedisMock from 'ioredis-mock';
import { describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const CHANGED: LiveMessage = {
  type: 'changed',
  data: { topic: 'chat', ids: { chatId: 'chat_1' } },
};

const instance = () => {
  const client = new RedisMock();
  const subscriber = client.duplicate();

  return {
    feed: new RedisLiveFeed(client, subscriber, logger),
    client,
    subscriber,
  };
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('RedisLiveFeed', () => {
  it('reaches a listener on another instance', async () => {
    const one = instance();
    const two = instance();
    const heard: LiveMessage[] = [];

    two.feed.subscribe(['workspace:ws_1'], (message) => heard.push(message));
    await settled();

    one.feed.publish('workspace:ws_1', CHANGED);
    one.feed.publish('workspace:ws_2', CHANGED);
    await settled();

    expect(heard).toEqual([CHANGED]);
  });

  it('subscribes to a channel once and lets go after the last listener', async () => {
    const { feed, subscriber } = instance();
    const subscribe = vi.spyOn(subscriber, 'subscribe');
    const unsubscribe = vi.spyOn(subscriber, 'unsubscribe');

    const first = feed.subscribe(['person:user_1'], () => {});
    const second = feed.subscribe(['person:user_1', 'person:user_1'], () => {});
    first();
    first();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    second();

    expect(unsubscribe).toHaveBeenCalledWith('spotlight-live:person:user_1');
  });

  it('tells every listener to resync when Redis comes back', async () => {
    const { feed, subscriber } = instance();
    const heard: string[] = [];
    feed.subscribe(['workspace:ws_1'], (message) => heard.push(message.type));

    subscriber.emit('ready');
    expect(heard).toEqual([]);

    subscriber.emit('ready');
    expect(heard).toEqual(['resync']);
  });

  it('skips a message it cannot read', async () => {
    const { feed, client } = instance();
    const heard: LiveMessage[] = [];
    feed.subscribe(['workspace:ws_1'], (message) => heard.push(message));
    await settled();

    await client.publish('spotlight-live:workspace:ws_1', 'not json');
    await client.publish('spotlight-live:workspace:ws_1', '{"type":1}');
    await settled();

    expect(heard).toEqual([]);
  });
});

describe('RedisLiveFeed when Redis fails', () => {
  it('asks every instance to resync once a change could not be published', async () => {
    const one = instance();
    const two = instance();
    const heard: string[] = [];
    two.feed.subscribe(['workspace:ws_1'], (message) =>
      heard.push(message.type),
    );
    await settled();

    const failing = vi
      .spyOn(one.client, 'publish')
      .mockRejectedValueOnce(new Error('timeout'));
    const flaky = new RedisLiveFeed(one.client, one.subscriber, logger, 5);

    flaky.publish('workspace:ws_1', CHANGED);
    await settled();

    expect(failing).toHaveBeenCalledTimes(2);
    expect(heard).toEqual(['resync']);
  });

  it('watches again after a failed subscribe and tells its listeners to resync', async () => {
    const { client, subscriber } = instance();
    const feed = new RedisLiveFeed(client, subscriber, logger, 5);
    vi.spyOn(subscriber, 'subscribe').mockRejectedValueOnce(
      new Error('timeout'),
    );
    const heard: string[] = [];

    feed.subscribe(['workspace:ws_1'], (message) => heard.push(message.type));
    await settled();

    expect(heard).toEqual(['resync']);
  });
});

describe('RedisLiveFeed retrying', () => {
  it('watches for resyncs again when that first subscribe failed', async () => {
    const one = instance();
    const client = new RedisMock();
    const subscriber = client.duplicate();
    vi.spyOn(subscriber, 'subscribe').mockRejectedValueOnce(
      new Error('timeout'),
    );
    const feed = new RedisLiveFeed(client, subscriber, logger, 5);
    const heard: string[] = [];
    feed.subscribe(['workspace:ws_1'], (message) => heard.push(message.type));
    await settled();
    heard.length = 0;

    await one.client.publish('spotlight-live:resync', '{}');
    await settled();

    expect(heard).toEqual(['resync']);
  });

  it('keeps one retry for a channel watched again while it waits', async () => {
    const { client, subscriber } = instance();
    const feed = new RedisLiveFeed(client, subscriber, logger, 5);
    await settled();
    const subscribe = vi
      .spyOn(subscriber, 'subscribe')
      .mockRejectedValueOnce(new Error('timeout'));

    feed.subscribe(['workspace:ws_1'], () => {})();
    await settled();
    feed.subscribe(['workspace:ws_1'], () => {});
    await settled();

    expect(
      subscribe.mock.calls.filter(
        ([channel]) => channel === 'spotlight-live:workspace:ws_1',
      ),
    ).toHaveLength(2);
  });

  it('stops retrying once the instance shuts down', async () => {
    const { client, subscriber } = instance();
    const publish = vi
      .spyOn(client, 'publish')
      .mockRejectedValue(new Error('closed'));
    const feed = new RedisLiveFeed(client, subscriber, logger, 5);

    feed.publish('workspace:ws_1', CHANGED);
    await settled();
    feed.onApplicationShutdown();
    const calls = publish.mock.calls.length;
    await settled();

    expect(publish.mock.calls.length).toBe(calls);
  });
});
