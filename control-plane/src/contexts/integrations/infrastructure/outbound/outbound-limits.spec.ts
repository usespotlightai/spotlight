import {
  InMemoryOutboundLimits,
  RedisOutboundLimits,
} from '@integrations/infrastructure/outbound/outbound-limits';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { describe, expect, it, vi } from 'vitest';

const quiet = () =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }) as unknown as LoggerPort;

const clock = (waitMs = 5_000) => {
  let now = 0;
  const slept: number[] = [];

  return {
    slept,
    waits: {
      now: () => now,
      sleep: async (ms: number) => {
        slept.push(ms);
        now += ms;
      },
      waitMs,
    },
  };
};

describe('InMemoryOutboundLimits', () => {
  it('lets a workspace send as many requests as its rate at once', async () => {
    const { waits, slept } = clock();
    const limits = new InMemoryOutboundLimits(3, waits);

    for (let at = 0; at < 3; at += 1) {
      expect(await limits.take('ws_1')).toBe(true);
    }
    expect(slept).toEqual([]);
  });

  it('makes a request over the rate wait for the next free one', async () => {
    const { waits, slept } = clock();
    const limits = new InMemoryOutboundLimits(2, waits);
    await limits.take('ws_1');
    await limits.take('ws_1');

    expect(await limits.take('ws_1')).toBe(true);
    expect(slept).toEqual([500]);
  });

  it('refuses a request it cannot send within the wait', async () => {
    const { waits } = clock(100);
    const limits = new InMemoryOutboundLimits(1, waits);
    await limits.take('ws_1');

    expect(await limits.take('ws_1')).toBe(false);
  });

  it('counts each workspace apart', async () => {
    const { waits } = clock(0);
    const limits = new InMemoryOutboundLimits(1, waits);

    expect(await limits.take('ws_1')).toBe(true);
    expect(await limits.take('ws_2')).toBe(true);
    expect(await limits.take('ws_1')).toBe(false);
  });
});

describe('RedisOutboundLimits', () => {
  it('waits as long as the store says, then sends', async () => {
    const answers = [250, -1];
    const store = { eval: vi.fn(async () => answers.shift()) };
    const { waits, slept } = clock();

    expect(
      await new RedisOutboundLimits(store, 20, quiet(), waits).take('ws_1'),
    ).toBe(true);
    expect(slept).toEqual([250]);
    expect(store.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'spotlight:outbound-limit:ws_1',
      20,
    );
  });

  it('limits on this instance alone when the store cannot be reached, and warns once a minute', async () => {
    const logger = quiet();
    const { waits } = clock(0);
    const limits = new RedisOutboundLimits(
      {
        eval: async () => {
          throw new Error('Command timed out');
        },
      },
      1,
      logger,
      waits,
    );

    expect(await limits.take('ws_1')).toBe(true);
    expect(await limits.take('ws_1')).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('counts each workspace apart on a shared store, as many requests as its rate at once', async () => {
    const redis = new RedisMock() as unknown as Redis;
    await redis.flushall();
    const { waits } = clock(0);
    const one = new RedisOutboundLimits(redis, 2, quiet(), waits);
    const other = new RedisOutboundLimits(redis.duplicate(), 2, quiet(), waits);

    expect([
      await one.take('ws_1'),
      await other.take('ws_1'),
      await one.take('ws_1'),
      await other.take('ws_2'),
    ]).toEqual([true, true, false, true]);
    await redis.quit();
  });
});
