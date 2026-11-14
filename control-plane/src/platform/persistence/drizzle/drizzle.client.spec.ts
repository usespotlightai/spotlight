import type { Env } from '@platform/config/env.schema';
import { createPool, createReadPool } from '@platform/persistence/drizzle/drizzle.client';
import { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';

const env = {
  DATABASE_URL: 'postgres://localhost/main',
  DATABASE_READ_URL: 'postgres://localhost/read',
  DATABASE_POOL_MAX: 7,
  DATABASE_CONNECTION_TIMEOUT_MS: 1_234,
  DATABASE_IDLE_TIMEOUT_MS: 5_678,
} as Env;

const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});

const optionsOf = (pool: Pool) => {
  pools.push(pool);
  return pool.options;
};

describe('database pools', () => {
  it('limits the main pool from the environment', () => {
    expect(optionsOf(createPool(env))).toMatchObject({
      max: 7,
      connectionTimeoutMillis: 1_234,
      idleTimeoutMillis: 5_678,
    });
  });

  it('limits the read pool from the environment', () => {
    const main = createPool(env);
    pools.push(main);

    expect(optionsOf(createReadPool(env, main))).toMatchObject({
      connectionString: env.DATABASE_READ_URL,
      max: 7,
      connectionTimeoutMillis: 1_234,
      idleTimeoutMillis: 5_678,
    });
  });
});
