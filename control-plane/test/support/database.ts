import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { databaseNamed } from './e2e-database-url';

export interface TestDatabase {
  readonly db: DrizzleDatabase;
  close(): Promise<void>;
}

const migrations = join(__dirname, '..', '..', 'drizzle');

export const migrated = async (pool: Pool): Promise<void> => {
  const files = (await readdir(migrations))
    .filter((each) => each.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(migrations, file), 'utf8');

    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
  }
};

export const openDatabase = async (about: string): Promise<TestDatabase> => {
  const here = process.env.DATABASE_URL ?? '';
  const database = `spotlight_${about}_${randomUUID().slice(0, 8)}`;

  const admin = new Client({ connectionString: here });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);

  const pool = new Pool({ connectionString: databaseNamed(here, database) });
  await migrated(pool);

  return {
    db: drizzle({ client: pool }),
    close: async () => {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.end();
    },
  };
};
