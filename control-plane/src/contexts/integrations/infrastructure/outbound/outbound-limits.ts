import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const KEY = 'spotlight:outbound-limit:';

const WAIT_MS = 5_000;

const WARN_EVERY_MS = 60_000;

const TAKE = `
local rate = tonumber(ARGV[1])
local time = redis.call('time')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local held = redis.call('hmget', KEYS[1], 'tokens', 'at')
local tokens = tonumber(held[1]) or rate
local at = tonumber(held[2]) or now
tokens = math.min(rate, tokens + math.max(0, now - at) / 1000 * rate)
local wait = -1
if tokens >= 1 then
  tokens = tokens - 1
else
  wait = math.ceil((1 - tokens) / rate * 1000)
end
redis.call('hset', KEYS[1], 'tokens', tokens, 'at', now)
redis.call('pexpire', KEYS[1], math.ceil(1000 + 1000 / rate))
return wait`;

type Sleep = (ms: number) => Promise<void>;

const sleeping: Sleep = (ms) =>
  new Promise((done) => setTimeout(done, ms).unref());

export interface LimitStore {
  eval(
    script: string,
    keys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

interface Waiting {
  readonly now: () => number;
  readonly sleep: Sleep;
  readonly waitMs: number;
}

const waiting = (overrides: Partial<Waiting> = {}): Waiting => ({
  now: () => performance.now(),
  sleep: sleeping,
  waitMs: WAIT_MS,
  ...overrides,
});

const takeWithin = async (
  next: () => Promise<number>,
  { now, sleep, waitMs }: Waiting,
): Promise<boolean> => {
  const until = now() + waitMs;

  for (;;) {
    const wait = await next();

    if (wait < 0) {
      return true;
    }

    const left = until - now();

    if (left <= 0) {
      return false;
    }

    await sleep(Math.min(wait, left));
  }
};

interface Bucket {
  tokens: number;
  at: number;
}

export class InMemoryOutboundLimits implements OutboundLimitsPort {
  private readonly buckets = new Map<string, Bucket>();
  private readonly waits: Waiting;

  constructor(
    readonly perSecond: number,
    waits: Partial<Waiting> = {},
  ) {
    this.waits = waiting(waits);
  }

  take(workspaceId: string): Promise<boolean> {
    return takeWithin(async () => this.next(workspaceId), this.waits);
  }

  private next(workspaceId: string): number {
    const now = this.waits.now();
    const bucket = this.buckets.get(workspaceId) ?? {
      tokens: this.perSecond,
      at: now,
    };

    bucket.tokens = Math.min(
      this.perSecond,
      bucket.tokens + (Math.max(0, now - bucket.at) / 1000) * this.perSecond,
    );
    bucket.at = now;
    this.buckets.set(workspaceId, bucket);

    if (bucket.tokens < 1) {
      return Math.ceil(((1 - bucket.tokens) / this.perSecond) * 1000);
    }

    bucket.tokens -= 1;
    return -1;
  }
}

export class RedisOutboundLimits implements OutboundLimitsPort {
  private readonly fallback: InMemoryOutboundLimits;
  private readonly waits: Waiting;
  private warnedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly store: LimitStore,
    readonly perSecond: number,
    private readonly logger: LoggerPort,
    waits: Partial<Waiting> = {},
  ) {
    this.waits = waiting(waits);
    this.fallback = new InMemoryOutboundLimits(perSecond, waits);
  }

  async take(workspaceId: string): Promise<boolean> {
    try {
      return await takeWithin(
        async () =>
          Number(
            await this.store.eval(TAKE, 1, KEY + workspaceId, this.perSecond),
          ),
        this.waits,
      );
    } catch (error) {
      this.warned(error);
      return this.fallback.take(workspaceId);
    }
  }

  private warned(error: unknown): void {
    const now = this.waits.now();

    if (now - this.warnedAt >= WARN_EVERY_MS) {
      this.warnedAt = now;
      this.logger.warn(
        { err: error },
        'Limiting outbound calls on this instance alone, without Redis',
      );
    }
  }
}
