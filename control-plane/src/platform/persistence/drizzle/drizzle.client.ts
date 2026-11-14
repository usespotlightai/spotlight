import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

const poolOf = (env: DatabaseEnv, connectionString: string): Pool =>
  new Pool({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
  });

export const createPool = (env: DatabaseEnv): Pool =>
  poolOf(env, env.DATABASE_URL);

export const createReadPool = (env: Env, pool: Pool): Pool =>
  env.DATABASE_READ_URL
    ? poolOf(env, env.DATABASE_READ_URL)
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });

export const createRelationalDatabase = <Schema extends Record<string, unknown>>(
  pool: Pool,
  schema: Schema,
) => drizzle({ client: pool, schema });
