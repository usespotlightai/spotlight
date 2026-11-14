import { databaseSchema } from '@platform/config/env.schema';
import {
  createPool,
  createReadPool,
} from '@platform/persistence/drizzle/drizzle.client';
import type { Env } from '@platform/config/env.schema';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const logger = (): LoggerPort => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const env = (extra: Record<string, unknown> = {}) =>
  databaseSchema.parse({
    DATABASE_URL: 'postgres://u:p@primary:5432/db',
    ...extra,
  }) as Env;

describe('database pools', () => {
  it('gives the primary pool its limits from the env', async () => {
    const pool = createPool(
      env({
        DATABASE_POOL_MAX: '4',
        DATABASE_POOL_IDLE_TIMEOUT_MS: '2000',
        DATABASE_POOL_CONNECTION_TIMEOUT_MS: '3000',
      }),
      logger(),
    );
    expect(pool.options).toMatchObject({
      max: 4,
      idleTimeoutMillis: 2000,
      connectionTimeoutMillis: 3000,
    });
    await pool.end();
  });

  it('gives the read pool the same limits', async () => {
    const config = {
      ...env({ DATABASE_POOL_MAX: '4' }),
      DATABASE_READ_URL: 'postgres://u:p@replica:5432/db',
    };
    const primary = createPool(config, logger());
    const read = createReadPool(config, primary, logger());
    expect(read).not.toBe(primary);
    expect(read.options).toMatchObject({
      max: 4,
      connectionString: 'postgres://u:p@replica:5432/db',
    });
    await Promise.all([primary.end(), read.end()]);
  });

  it('reuses the primary pool when no read url is set', async () => {
    const config = env();
    const primary = createPool(config, logger());
    expect(createReadPool(config, primary, logger())).toBe(primary);
    await primary.end();
  });

  it('logs a failed idle client instead of ending the process', async () => {
    const log = logger();
    const pool = createPool(env(), log);
    pool.emit('error', new Error('terminated'));
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ pool: 'primary' }),
      'Postgres pool client failed',
    );
    await pool.end();
  });

  it('defaults the limits', () => {
    expect(env()).toMatchObject({
      DATABASE_POOL_MAX: 10,
      DATABASE_POOL_IDLE_TIMEOUT_MS: 10_000,
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: 5000,
    });
  });

  it.each(['0', 'many'])('rejects the pool max %s', (value) => {
    expect(() => env({ DATABASE_POOL_MAX: value })).toThrow(/DATABASE_POOL_MAX/);
  });
});
