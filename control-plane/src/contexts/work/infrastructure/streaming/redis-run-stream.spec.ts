import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunEventView } from '@work/application/ports/run-stream.port';
import {
  type RedisPublisher,
  RedisRunStream,
  type RedisSubscriber,
} from '@work/infrastructure/streaming/redis-run-stream';
import { describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const bus = () => {
  const subscribers = new Set<{
    channels: Set<string>;
    deliver: (channel: string, message: string) => void;
  }>();

  const publisher = (): RedisPublisher => ({
    publish: async (channel, message) => {
      for (const subscriber of subscribers) {
        if (subscriber.channels.has(channel)) {
          subscriber.deliver(channel, message);
        }
      }
    },
    quit: async () => 'OK',
  });

  const subscriber = (): RedisSubscriber & { channels: Set<string> } => {
    const entry = {
      channels: new Set<string>(),
      deliver: (_channel: string, _message: string) => {},
    };
    subscribers.add(entry);

    return {
      channels: entry.channels,
      subscribe: vi.fn(async (channel: string) => entry.channels.add(channel)),
      unsubscribe: vi.fn(async (channel: string) =>
        entry.channels.delete(channel),
      ),
      on: (_event, listener) => {
        entry.deliver = listener;
      },
      quit: async () => 'OK',
    };
  };

  const instance = () => {
    const listening = subscriber();
    return {
      stream: new RedisRunStream(publisher(), listening, logger),
      listening,
    };
  };

  return { instance };
};

const event = (seq: number): RunEventView => ({
  attempt: 1,
  seq,
  type: 'step',
  at: '2026-11-01T12:00:00.000Z',
});

describe('RedisRunStream', () => {
  it('hands events published on one instance to a watcher on another', async () => {
    const { instance } = bus();
    const a = instance();
    const b = instance();
    const seen: RunEventView[] = [];

    a.stream.subscribe('run_1', (view) => seen.push(view));
    await vi.waitFor(() => expect(a.listening.channels.size).toBe(1));

    b.stream.publish('run_1', [event(1), event(2)]);

    await vi.waitFor(() => expect(seen).toEqual([event(1), event(2)]));
  });

  it('hands nothing to a watcher of another run', async () => {
    const { instance } = bus();
    const a = instance();
    const seen: RunEventView[] = [];

    a.stream.subscribe('run_1', (view) => seen.push(view));
    await vi.waitFor(() => expect(a.listening.channels.size).toBe(1));

    a.stream.publish('run_2', [event(1)]);
    a.stream.publish('run_1', [event(2)]);

    await vi.waitFor(() => expect(seen).toEqual([event(2)]));
  });

  it('watches a run on Redis once and stops when its last watcher leaves', async () => {
    const { instance } = bus();
    const a = instance();

    const first = a.stream.subscribe('run_1', () => {});
    const second = a.stream.subscribe('run_1', () => {});
    first();
    first();

    expect(a.listening.subscribe).toHaveBeenCalledTimes(1);
    expect(a.listening.unsubscribe).not.toHaveBeenCalled();

    second();

    expect(a.listening.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
