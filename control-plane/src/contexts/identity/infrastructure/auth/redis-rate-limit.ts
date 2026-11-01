import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { BetterAuthOptions } from 'better-auth';

export type RateLimitStorage = NonNullable<
  NonNullable<BetterAuthOptions['rateLimit']>['customStorage']
>;

export interface RateLimitStore {
  eval(
    script: string,
    keys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

const PREFIX = 'spotlight:rate-limit:';

const CONSUME = `
local count = redis.call('incr', KEYS[1])
if count == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then
  redis.call('decr', KEYS[1])
  return redis.call('pttl', KEYS[1])
end
return -1`;

export const redisRateLimit = (
  store: RateLimitStore,
  logger: LoggerPort,
): RateLimitStorage => ({
  consume: async (key, { window, max }) => {
    try {
      const waitMs = Number(
        await store.eval(CONSUME, 1, PREFIX + key, window * 1000, max),
      );

      return waitMs < 0
        ? { allowed: true, retryAfter: null }
        : { allowed: false, retryAfter: Math.ceil(waitMs / 1000) };
    } catch (error) {
      logger.warn({ err: error }, 'Rate limiting without Redis');
      return { allowed: true, retryAfter: null };
    }
  },
});
