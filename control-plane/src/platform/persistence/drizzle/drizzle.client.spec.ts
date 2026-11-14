import type { Env } from '@platform/config/env.schema';
import {
  createPool,
  createReadPool,
} from '@platform/persistence/drizzle/drizzle.client';
import { afterEach, describe, expect, it } from 'vitest';

const envOf = (overrides: Partial<Env> = {}): Env =>
  ({
    DATABASE_URL: 'postgres://app@primary/spotlight',
    DATABASE_POOL_MAX: 10,
    DATABASE_POOL_IDLE_TIMEOUT_MS: 30_000,
    ...overrides,
  }) as Env;

describe('database pools', () => {
  const pools: { end(): Promise<void> }[] = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it('limits the pool to the configured size and idle time', () => {
    const pool = createPool(
      envOf({ DATABASE_POOL_MAX: 4, DATABASE_POOL_IDLE_TIMEOUT_MS: 5_000 }),
    );
    pools.push(pool);

    expect(pool.options.max).toBe(4);
    expect(pool.options.idleTimeoutMillis).toBe(5_000);
  });

  it('limits the read pool in the same way', () => {
    const env = envOf({
      DATABASE_READ_URL: 'postgres://app@replica/spotlight',
      DATABASE_POOL_MAX: 3,
    });
    const pool = createPool(env);
    const readPool = createReadPool(env, pool);
    pools.push(pool, readPool);

    expect(readPool).not.toBe(pool);
    expect(readPool.options.max).toBe(3);
  });
});
