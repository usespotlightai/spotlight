import { databaseSchema } from '@platform/config/env.schema';
import { poolOptions } from '@platform/persistence/drizzle/drizzle.client';
import { describe, expect, it } from 'vitest';

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
