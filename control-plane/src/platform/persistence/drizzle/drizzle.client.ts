import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export type PoolErrorHandler = (error: Error) => void;

export const poolOptions = (
  env: DatabaseEnv,
  connectionString: string,
): PoolConfig => ({
  connectionString,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
});

export const logPoolErrorToStderr: PoolErrorHandler = (error) => {
  process.stderr.write(
    `${JSON.stringify({ level: 'error', msg: 'Database pool error', err: error.message })}\n`,
  );
};

const logPoolError =
  (logger: LoggerPort): PoolErrorHandler =>
  (error) =>
    logger.error({ err: error }, 'Database pool error');

export const openPool = (
  env: DatabaseEnv,
  connectionString: string,
  onError: PoolErrorHandler,
): Pool => new Pool(poolOptions(env, connectionString)).on('error', onError);

export const createPool = (env: Env, logger: LoggerPort): Pool =>
  openPool(env, env.DATABASE_URL, logPoolError(logger));

export const createReadPool = (
  env: Env,
  pool: Pool,
  logger: LoggerPort,
): Pool =>
  env.DATABASE_READ_URL
    ? openPool(env, env.DATABASE_READ_URL, logPoolError(logger))
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
