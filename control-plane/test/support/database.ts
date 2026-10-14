import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { databaseNamed, E2E_DATABASE, E2E_TEMPLATE } from './e2e-database-url';

export interface TestDatabase {
  readonly db: DrizzleDatabase;
  readonly url: string;
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

const asAdmin = async (statement: string): Promise<void> => {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(statement);
  } finally {
    await admin.end();
  }
};

export const clonedDatabase = async (about: string): Promise<string> => {
  const database = `${E2E_DATABASE}_${about}_${randomUUID().slice(0, 8)}`;

  await asAdmin(`CREATE DATABASE "${database}" TEMPLATE "${E2E_TEMPLATE}"`);

  return databaseNamed(process.env.DATABASE_URL ?? '', database);
};

export const droppedDatabase = (url: string): Promise<void> =>
  asAdmin(
    `DROP DATABASE IF EXISTS "${new URL(url).pathname.slice(1)}" WITH (FORCE)`,
  );

export const openDatabase = async (about: string): Promise<TestDatabase> => {
  const url = await clonedDatabase(about);
  const pool = new Pool({ connectionString: url });

  return {
    db: drizzle({ client: pool }),
    url,
    close: async () => {
      await pool.end();
      await droppedDatabase(url);
    },
  };
};
