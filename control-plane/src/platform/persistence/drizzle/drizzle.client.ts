import type { Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { Pool, type PoolConfig } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export type PoolName = 'primary' | 'read';

export const POOL_OPTIONS = {
  keepAlive: true,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} satisfies PoolConfig;

export const createPool = (env: Env): Pool =>
  new Pool({ ...POOL_OPTIONS, connectionString: env.DATABASE_URL });

export const attachPoolErrorHandler = (
  pool: Pool,
  name: PoolName,
  logger: LoggerPort,
  telemetry: TelemetryPort,
): Pool =>
  pool.on('error', (error: NodeJS.ErrnoException) => {
    telemetry.count('db_pool_errors_total', { pool: name });
    logger.warn(
      { err: error, code: error.code, pool: name },
      'The database pool lost an idle connection',
    );
  });

export const createReadPool = (env: Env, pool: Pool): Pool =>
  env.DATABASE_READ_URL
    ? new Pool({ ...POOL_OPTIONS, connectionString: env.DATABASE_READ_URL })
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
