import type { Env } from '@platform/config/env.schema';
import {
  attachPoolErrorHandler,
  createPool,
  createReadPool,
  POOL_OPTIONS,
} from '@platform/persistence/drizzle/drizzle.client';
import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

const env = (extra: Partial<Env> = {}) =>
  ({ DATABASE_URL: 'postgres://primary/db', ...extra }) as Env;

describe('database pools', () => {
  it('gives the primary pool the shared options', async () => {
    const pool = createPool(env());

    expect(pool.options).toMatchObject(POOL_OPTIONS);
    await pool.end();
  });

  it('gives the read pool the shared options', async () => {
    const primary = createPool(env());
    const read = createReadPool(
      env({ DATABASE_READ_URL: 'postgres://read/db' }),
      primary,
    );

    expect(read).not.toBe(primary);
    expect(read.options).toMatchObject(POOL_OPTIONS);
    await Promise.all([primary.end(), read.end()]);
  });

  it('logs and counts an idle connection error without throwing', () => {
    const pool = new EventEmitter() as unknown as Pool;
    const logger = { warn: vi.fn() };
    const telemetry = { count: vi.fn() };
    attachPoolErrorHandler(pool, 'read', logger as never, telemetry as never);

    const error = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
    });

    expect(() => pool.emit('error', error)).not.toThrow();
    expect(telemetry.count).toHaveBeenCalledWith('db_pool_errors_total', {
      pool: 'read',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ECONNRESET', pool: 'read' }),
      expect.any(String),
    );
  });
});
