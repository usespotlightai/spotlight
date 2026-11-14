import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export const poolOptions = (
  env: DatabaseEnv,
  connectionString: string,
): PoolConfig => ({
  connectionString,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
});

const quiet = (pool: Pool): Pool => {
  // A dropped idle connection must not end the process.
  pool.on('error', () => undefined);
  return pool;
};

export const openPool = (env: DatabaseEnv, connectionString: string): Pool =>
  quiet(new Pool(poolOptions(env, connectionString)));

export const createPool = (env: Env): Pool =>
  openPool(env, env.DATABASE_URL);

export const createReadPool = (env: Env, pool: Pool): Pool =>
  env.DATABASE_READ_URL
    ? openPool(env, env.DATABASE_READ_URL)
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
