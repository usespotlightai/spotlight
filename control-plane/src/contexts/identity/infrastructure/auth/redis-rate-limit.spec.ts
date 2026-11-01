import { redisRateLimit } from '@identity/infrastructure/auth/redis-rate-limit';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const rule = { window: 10, max: 3 };

describe('redisRateLimit', () => {
  it('allows a request the store counted within the limit', async () => {
    const eval_ = vi.fn(async () => -1);

    await expect(
      redisRateLimit({ eval: eval_ }, logger).consume('ip|/sign-in', rule),
    ).resolves.toEqual({ allowed: true, retryAfter: null });
    expect(eval_).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'spotlight:rate-limit:ip|/sign-in',
      10_000,
      3,
    );
  });

  it('refuses a request over the limit until the window frees up', async () => {
    await expect(
      redisRateLimit({ eval: async () => 1_500 }, logger).consume('key', rule),
    ).resolves.toEqual({ allowed: false, retryAfter: 2 });
  });

  it('allows the request when the store cannot be reached', async () => {
    await expect(
      redisRateLimit(
        {
          eval: async () => {
            throw new Error('Command timed out');
          },
        },
        logger,
      ).consume('key', rule),
    ).resolves.toEqual({ allowed: true, retryAfter: null });
  });

  it('counts requests across connections and refuses the one over the limit', async () => {
    const one = new RedisMock() as unknown as Redis;
    await one.flushall();
    const two = one.duplicate();
    const limit = { window: 10, max: 2 };

    await redisRateLimit(one, logger).consume('ip|/sign-in', limit);
    await redisRateLimit(two, logger).consume('ip|/sign-in', limit);
    const third = await redisRateLimit(one, logger).consume(
      'ip|/sign-in',
      limit,
    );

    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.retryAfter).toBeLessThanOrEqual(10);
    await expect(
      redisRateLimit(two, logger).consume('ip|/other', limit),
    ).resolves.toEqual({ allowed: true, retryAfter: null });
    await Promise.all([one.quit(), two.quit()]);
  });

  it('refuses a request over the limit even when the key has no expiry', async () => {
    const redis = new RedisMock() as unknown as Redis;
    await redis.flushall();
    await redis.set('spotlight:rate-limit:stuck', '5');

    await expect(
      redisRateLimit(redis, logger).consume('stuck', rule),
    ).resolves.toEqual({ allowed: false, retryAfter: 1 });
    await redis.quit();
  });
});
