import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import { describe, expect, it } from 'vitest';

describe('InMemoryLiveFeed', () => {
  it('sends a message to the listeners of its channel only', () => {
    const feed = new InMemoryLiveFeed();
    const heard: string[] = [];

    feed.subscribe(['workspace:ws_1', 'person:user_1'], (message) =>
      heard.push(message.type),
    );
    feed.publish('workspace:ws_1', { type: 'changed', data: {} });
    feed.publish('person:user_1', { type: 'notification', data: {} });
    feed.publish('workspace:ws_2', { type: 'changed', data: {} });

    expect(heard).toEqual(['changed', 'notification']);
  });

  it('stops sending after the listener detaches', () => {
    const feed = new InMemoryLiveFeed();
    const heard: string[] = [];
    const detach = feed.subscribe(['workspace:ws_1'], (message) =>
      heard.push(message.type),
    );

    detach();
    feed.publish('workspace:ws_1', { type: 'changed', data: {} });

    expect(heard).toEqual([]);
  });

  it('tells each listener to resync once, whatever its channels', () => {
    const feed = new InMemoryLiveFeed();
    const heard: string[] = [];
    feed.subscribe(['workspace:ws_1', 'person:user_1'], (message) =>
      heard.push(message.type),
    );

    feed.resync();

    expect(heard).toEqual(['resync']);
  });
});
