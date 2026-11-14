import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { Pool, type PoolConfig } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export const poolOptions = (
  env: DatabaseEnv,
  connectionString: string,
  max = env.DATABASE_POOL_MAX,
): PoolConfig => ({
  connectionString,
  max,
  idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
});

const guarded = (pool: Pool, name: string, logger: LoggerPort): Pool => {
  pool.on('error', (error) =>
    logger.warn({ err: error, pool: name }, 'Postgres pool client failed'),
  );
  return pool;
};

export const createPool = (env: Env, logger: LoggerPort): Pool =>
  guarded(new Pool(poolOptions(env, env.DATABASE_URL)), 'primary', logger);

export const createReadPool = (
  env: Env,
  pool: Pool,
  logger: LoggerPort,
): Pool =>
  env.DATABASE_READ_URL
    ? guarded(new Pool(poolOptions(env, env.DATABASE_READ_URL)), 'read', logger)
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
