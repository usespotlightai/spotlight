import { databaseSchema } from '@platform/config/env.schema';
import { describe, expect, it } from 'vitest';

const url = 'postgres://localhost/spotlight';

describe('databaseSchema pool limits', () => {
  it('defaults the pool size and timeouts', () => {
    expect(databaseSchema.parse({ DATABASE_URL: url })).toMatchObject({
      DATABASE_POOL_MAX: 10,
      DATABASE_CONNECTION_TIMEOUT_MS: 5_000,
      DATABASE_IDLE_TIMEOUT_MS: 30_000,
    });
  });

  it.each([
    'DATABASE_POOL_MAX',
    'DATABASE_CONNECTION_TIMEOUT_MS',
    'DATABASE_IDLE_TIMEOUT_MS',
  ])('rejects zero and negative values for %s', (key) => {
    expect(
      databaseSchema.safeParse({ DATABASE_URL: url, [key]: '0' }).success,
    ).toBe(false);
    expect(
      databaseSchema.safeParse({ DATABASE_URL: url, [key]: '-1' }).success,
    ).toBe(false);
  });
});
