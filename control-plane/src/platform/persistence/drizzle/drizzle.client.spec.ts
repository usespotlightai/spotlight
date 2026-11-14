import { databaseSchema } from '@platform/config/env.schema';
import {
  countFailures,
  DATABASE_FAILURES_METRIC,
  poolOptions,
} from '@platform/persistence/drizzle/drizzle.client';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

const URL = 'postgres://localhost/spotlight';

describe('poolOptions', () => {
  it('passes the configured maximum to the pool', () => {
    const env = databaseSchema.parse({
      DATABASE_URL: URL,
      DATABASE_POOL_MAX: '3',
    });

    expect(poolOptions(env).max).toBe(3);
  });

  it('defaults the maximum below the pg default of ten', () => {
    const env = databaseSchema.parse({ DATABASE_URL: URL });

    expect(poolOptions(env).max).toBe(5);
  });

  it('sets a connection timeout so a full pool fails fast', () => {
    const env = databaseSchema.parse({ DATABASE_URL: URL });

    expect(poolOptions(env).connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it('uses the given connection string for a read pool', () => {
    const env = databaseSchema.parse({ DATABASE_URL: URL });

    expect(poolOptions(env, 'postgres://replica/spotlight').connectionString).toBe(
      'postgres://replica/spotlight',
    );
  });

  it.each(['0', '-1', 'many', '2.5'])('rejects pool maximum %s', (value) => {
    expect(
      databaseSchema.safeParse({ DATABASE_URL: URL, DATABASE_POOL_MAX: value })
        .success,
    ).toBe(false);
  });
});

describe('countFailures', () => {
  const failingPool = (error: Error) =>
    ({
      query: () => Promise.reject(error),
      connect: () => Promise.reject(error),
    }) as unknown as Pool;

  it('counts a refused query by its SQLSTATE and rethrows', async () => {
    const telemetry = { count: vi.fn(), measure: vi.fn(), inSpan: vi.fn() };
    const error = Object.assign(new Error('slots'), { code: '53300' });
    const pool = countFailures(failingPool(error), telemetry);

    await expect(pool.query('select 1')).rejects.toBe(error);
    expect(telemetry.count).toHaveBeenCalledWith(DATABASE_FAILURES_METRIC, {
      'spotlight.database.sqlstate': '53300',
    });
  });

  it('counts a refused connection by its SQLSTATE and rethrows', async () => {
    const telemetry = { count: vi.fn(), measure: vi.fn(), inSpan: vi.fn() };
    const error = Object.assign(new Error('slots'), { code: '53300' });
    const pool = countFailures(failingPool(error), telemetry);

    await expect(pool.connect()).rejects.toBe(error);
    expect(telemetry.count).toHaveBeenCalledTimes(1);
  });

  it('counts an error without a SQLSTATE as unknown', async () => {
    const telemetry = { count: vi.fn(), measure: vi.fn(), inSpan: vi.fn() };
    const pool = countFailures(failingPool(new Error('timeout')), telemetry);

    await expect(pool.query('select 1')).rejects.toThrow('timeout');
    expect(telemetry.count).toHaveBeenCalledWith(DATABASE_FAILURES_METRIC, {
      'spotlight.database.sqlstate': 'unknown',
    });
  });
});
