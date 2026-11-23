import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';

import {
  databaseNamed,
  E2E_DATABASE,
  E2E_POOLER,
  E2E_TEMPLATE,
} from './e2e-database-url';
import { eventually } from './eventually';

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

  return databaseNamed(E2E_POOLER ?? process.env.DATABASE_URL ?? '', database);
};

const IDLE_BEFORE_DROP_MS = 5_000;

const waitUntilNoConnections = async (
  admin: Client,
  database: string,
): Promise<void> => {
  try {
    await eventually(async () => {
      const { rows } = await admin.query<{ connected: number }>(
        'SELECT count(*)::int AS connected FROM pg_stat_activity WHERE datname = $1',
        [database],
      );

      return rows[0]?.connected === 0;
    }, IDLE_BEFORE_DROP_MS);
  } catch {
    process.stderr.write(
      `The test database ${database} still has connections after ${IDLE_BEFORE_DROP_MS} ms; the forced drop cuts them\n`,
    );
  }
};

const dropOnceIdle = async (database: string): Promise<void> => {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });

  await admin.connect();
  try {
    await waitUntilNoConnections(admin, database);
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
};

let dropping = Promise.resolve();

// Each DROP DATABASE forces a checkpoint, which takes seconds while other files write, so closing does not wait for it.
// The drops of one worker run one at a time, so that their checkpoints do not pile up. The global teardown drops whatever is still left.
export const dropDatabaseLater = (url: string): void => {
  const database = new URL(url).pathname.slice(1);

  dropping = dropping
    .then(() => dropOnceIdle(database))
    .catch((error: unknown) => {
      process.stderr.write(
        `Could not drop the test database ${database}; the global teardown drops it: ${String(error)}\n`,
      );
    });
};

export const openDatabase = async (about: string): Promise<TestDatabase> => {
  const url = await clonedDatabase(about);
  const pool = new Pool({ connectionString: url });

  return {
    db: drizzle({ client: pool }),
    url,
    close: async () => {
      await pool.end();
      dropDatabaseLater(url);
    },
  };
};
