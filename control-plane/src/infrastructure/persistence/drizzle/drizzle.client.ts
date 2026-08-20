import { env } from '@infrastructure/config/env';
import * as schema from '@infrastructure/persistence/drizzle/schema';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export type DrizzleDatabase = NodePgDatabase<typeof schema>;

export const db: DrizzleDatabase = drizzle({ client: pool, schema });
