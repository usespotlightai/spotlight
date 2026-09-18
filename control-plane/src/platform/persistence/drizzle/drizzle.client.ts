import type { Env } from '@platform/config/env.schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

export const createPool = (env: Env): Pool =>
  new Pool({ connectionString: env.DATABASE_URL });

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool });
