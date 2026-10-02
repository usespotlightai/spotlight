import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { databaseNamed } from './e2e-database-url';

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

const LET_GO_TRIES = 60;

const droppedOnceLetGo = async (
  admin: Client,
  database: string,
): Promise<void> => {
  for (let tried = 0; tried < LET_GO_TRIES; tried += 1) {
    const dropped = await admin
      .query(`DROP DATABASE IF EXISTS "${database}"`)
      .then(
        () => true,
        () => false,
      );

    if (dropped) {
      return;
    }

    await new Promise((settle) => setTimeout(settle, 50));
  }

  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
};

export const openDatabase = async (about: string): Promise<TestDatabase> => {
  const here = process.env.DATABASE_URL ?? '';
  const database = `spotlight_${about}_${randomUUID().slice(0, 8)}`;

  const admin = new Client({ connectionString: here });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);

  const url = databaseNamed(here, database);
  const pool = new Pool({ connectionString: url });
  await migrated(pool);

  return {
    db: drizzle({ client: pool }),
    url,
    close: async () => {
      await pool.end();
      await droppedOnceLetGo(admin, database);
      await admin.end();
    },
  };
};
