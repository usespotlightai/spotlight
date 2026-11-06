import type { ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RateLimit } from '@platform/http/decorators/rate-limited.decorator';
import { RateLimitGuard } from '@platform/http/guards/rate-limit.guard';
import type { RedisConnection } from '@platform/redis/redis-connection';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as LoggerPort;

const limit: RateLimit = { name: 'invite-preview', max: 2, windowSeconds: 60 };

const contextFor = (
  headers: Record<string, string>,
  setHeader = vi.fn(),
): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ headers, ip: '10.0.0.1' }),
      getResponse: () => ({ setHeader }),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (client: Redis | null, routeLimit: RateLimit | undefined) => {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(routeLimit);
  return new RateLimitGuard(
    reflector,
    { client } as unknown as RedisConnection,
    logger,
  );
};

describe('RateLimitGuard', () => {
  let redis: Redis;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    await redis.flushall();
  });

  it('refuses the request over the limit with 429 and Retry-After', async () => {
    const guard = guardWith(redis, limit);
    const setHeader = vi.fn();
    const from = { 'cf-connecting-ip': '203.0.113.7' };

    await guard.canActivate(contextFor(from));
    await guard.canActivate(contextFor(from));
    const third = guard.canActivate(contextFor(from, setHeader));

    await expect(third).rejects.toBeInstanceOf(HttpException);
    await expect(third).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('counts each client address on its own', async () => {
    const guard = guardWith(redis, limit);

    await guard.canActivate(contextFor({ 'x-forwarded-for': '198.51.100.1' }));
    await guard.canActivate(contextFor({ 'x-forwarded-for': '198.51.100.1' }));

    await expect(
      guard.canActivate(contextFor({ 'x-forwarded-for': '198.51.100.2' })),
    ).resolves.toBe(true);
  });

  it('keys on the address the nearest proxy added, not on one the client chose', async () => {
    const guard = guardWith(redis, limit);
    const forwarded = (chosen: string) => ({
      'x-forwarded-for': `${chosen}, 198.51.100.9`,
    });

    await guard.canActivate(contextFor(forwarded('192.0.2.1')));
    await guard.canActivate(contextFor(forwarded('192.0.2.2')));

    await expect(
      guard.canActivate(contextFor(forwarded('192.0.2.3'))),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('lets a route without a limit through', async () => {
    const guard = guardWith(redis, undefined);

    for (let each = 0; each < 5; each++) {
      await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    }
  });

  it('lets the request through when Redis cannot be reached', async () => {
    const broken = {
      eval: async () => {
        throw new Error('Command timed out');
      },
    } as unknown as Redis;

    await expect(
      guardWith(broken, limit).canActivate(contextFor({})),
    ).resolves.toBe(true);
  });
});
