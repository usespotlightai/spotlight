import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import * as schema from '@infrastructure/persistence/drizzle/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';

/** A database of its own with the real migrations run into it, dropped after. */
export interface TestDatabase {
  readonly db: DrizzleDatabase;
  close(): Promise<void>;
}

const migrations = join(__dirname, '..', '..', 'drizzle');

const named = (url: string, database: string) =>
  url.replace(/\/[^/?]*(\?|$)/, `/${database}$1`);

const migrated = async (pool: Pool): Promise<void> => {
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

  const pool = new Pool({ connectionString: named(here, database) });
  await migrated(pool);

  return {
    db: drizzle({ client: pool, schema }),
    close: async () => {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.end();
    },
  };
};
