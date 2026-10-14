import type { Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export const createPool = (env: Env): Pool =>
  new Pool({ connectionString: env.DATABASE_URL });

export const createReadPool = (env: Env, pool: Pool): Pool =>
  env.DATABASE_READ_URL
    ? new Pool({ connectionString: env.DATABASE_READ_URL })
    : pool;

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });
