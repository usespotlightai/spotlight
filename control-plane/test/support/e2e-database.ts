import { Client, Pool } from 'pg';
import { migrated } from './database';
import {
  databaseNamed,
  E2E_DATABASE,
  E2E_SERVER,
  E2E_TEMPLATE,
  isE2eDatabase,
} from './e2e-database-url';

const DROPPED_AT_ONCE = 40;

const onServer = async <T>(
  server: string,
  work: (admin: Client) => Promise<T>,
): Promise<T> => {
  const admin = new Client({ connectionString: server });

  await admin.connect();
  try {
    return await work(admin);
  } finally {
    await admin.end();
  }
};

const droppedAll = async (server: string): Promise<void> => {
  const { rows } = await onServer(server, (admin) =>
    admin.query<{ datname: string }>('SELECT datname FROM pg_database'),
  );

  const databases = rows.map((row) => row.datname).filter(isE2eDatabase);

  for (let at = 0; at < databases.length; at += DROPPED_AT_ONCE) {
    await Promise.all(
      databases
        .slice(at, at + DROPPED_AT_ONCE)
        .map((database) =>
          onServer(server, (admin) =>
            admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`),
          ),
        ),
    );
  }
};

export default async function setup(): Promise<() => Promise<void>> {
  const server = E2E_SERVER;

  await droppedAll(server);
  await onServer(server, (admin) =>
    admin.query(`CREATE DATABASE "${E2E_TEMPLATE}"`),
  );

  const pool = new Pool({
    connectionString: databaseNamed(server, E2E_TEMPLATE),
  });
  try {
    await migrated(pool);
  } finally {
    await pool.end();
  }

  await onServer(server, (admin) =>
    admin.query(`CREATE DATABASE "${E2E_DATABASE}" TEMPLATE "${E2E_TEMPLATE}"`),
  );

  return () => droppedAll(server);
}
