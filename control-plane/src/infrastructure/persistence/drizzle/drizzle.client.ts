import type { Env } from '@infrastructure/config/env.schema';
import * as schema from '@infrastructure/persistence/drizzle/schemas';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DrizzleDatabase = NodePgDatabase<typeof schema>;

export const createPool = (env: Env): Pool =>
  new Pool({ connectionString: env.DATABASE_URL });

export const createDatabase = (pool: Pool): DrizzleDatabase =>
  drizzle({ client: pool, schema });
