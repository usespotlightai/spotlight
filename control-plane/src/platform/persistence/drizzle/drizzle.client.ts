import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

const POOL_CONNECTION_TIMEOUT_MS = 10_000;

export const poolOptions = (
  env: DatabaseEnv,
  connectionString: string = env.DATABASE_URL,
): PoolConfig => ({
  connectionString,
  max: env.DATABASE_POOL_MAX,
  connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
});

export const createPool = (env: Env): Pool => new Pool(poolOptions(env));

export const createReadPool = (env: Env, pool: Pool): Pool =>
  env.DATABASE_READ_URL
    ? new Pool(poolOptions(env, env.DATABASE_READ_URL))
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
