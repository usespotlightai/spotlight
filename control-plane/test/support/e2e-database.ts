import { Client, Pool } from 'pg';
import { migrated } from './database';
import { databaseNamed, E2E_DATABASE } from './e2e-database-url';

const onServer = async (server: string, ...statements: string[]) => {
  const admin = new Client({ connectionString: server });

  await admin.connect();
  try {
    for (const statement of statements) {
      await admin.query(statement);
    }
  } finally {
    await admin.end();
  }
};

const dropped = `DROP DATABASE IF EXISTS "${E2E_DATABASE}" WITH (FORCE)`;

export default async function setup(): Promise<() => Promise<void>> {
  const server = process.env.DATABASE_URL ?? '';

  await onServer(server, dropped, `CREATE DATABASE "${E2E_DATABASE}"`);

  const pool = new Pool({
    connectionString: databaseNamed(server, E2E_DATABASE),
  });
  try {
    await migrated(pool);
  } finally {
    await pool.end();
  }

  return () => onServer(server, dropped);
}
