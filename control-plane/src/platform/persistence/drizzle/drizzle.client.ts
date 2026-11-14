import type { DatabaseEnv, Env } from '@platform/config/env.schema';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
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

export const DATABASE_FAILURES_METRIC = 'spotlight.database.failures';

type Failure = Error & { code?: string };

export const countFailures = (pool: Pool, telemetry: TelemetryPort): Pool => {
  const count = (error: unknown): never => {
    telemetry.count(DATABASE_FAILURES_METRIC, {
      'spotlight.database.sqlstate': (error as Failure).code ?? 'unknown',
    });
    throw error;
  };
  const query = pool.query.bind(pool) as (...args: unknown[]) => unknown;
  const connect = pool.connect.bind(pool) as () => Promise<unknown>;

  pool.query = ((...args: unknown[]) => {
    const result = query(...args);

    return result instanceof Promise ? result.catch(count) : result;
  }) as typeof pool.query;
  pool.connect = ((...args: unknown[]) =>
    args.length > 0
      ? (connect as (...rest: unknown[]) => unknown)(...args)
      : connect().catch(count)) as typeof pool.connect;

  return pool;
};

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
