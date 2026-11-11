import {
  consumeFixedWindow,
  type ScriptRunner,
} from '@platform/redis/fixed-window';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { BetterAuthOptions } from 'better-auth';

export type RateLimitStorage = NonNullable<
  NonNullable<BetterAuthOptions['rateLimit']>['customStorage']
>;

export type RateLimitStore = ScriptRunner;

const PREFIX = 'spotlight:rate-limit:';

export const redisRateLimit = (
  store: RateLimitStore,
  logger: LoggerPort,
): RateLimitStorage => ({
  consume: async (key, { window, max }) => {
    try {
      const waitMs = await consumeFixedWindow(
        store,
        PREFIX + key,
        window * 1000,
        max,
      );

      return waitMs === null
        ? { allowed: true, retryAfter: null }
        : { allowed: false, retryAfter: Math.ceil(waitMs / 1000) };
    } catch (error) {
      logger.warn({ err: error }, 'Rate limiting without Redis');
      return { allowed: true, retryAfter: null };
    }
  },
});
