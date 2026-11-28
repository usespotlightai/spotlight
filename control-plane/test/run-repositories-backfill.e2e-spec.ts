import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const BACKFILL = join(
  __dirname,
  '..',
  'drizzle',
  '20261128101827_backfill_run_repositories_in_full.sql',
);

let database: TestDatabase;

const run = async (statement: string): Promise<void> => {
  await database.db.execute(sql.raw(statement));
};

const backfilled = async (): Promise<void> => {
  const statements = (await readFile(BACKFILL, 'utf8')).split(
    '--> statement-breakpoint',
  );

  for (const statement of statements) {
    if (statement.trim()) {
      await run(statement);
    }
  }
};

const taskDispatch = (
  id: string,
  config: readonly string[],
  reviewing: string | null = null,
): string => `
  INSERT INTO "dispatch" (
    "id", "workspace_id", "team_id", "kind", "task_id", "task_revision", "station_id",
    "briefed_task", "station_config", "station_fingerprint", "ordered_at"
  ) VALUES (
    '${id}', 'ws_backfill', 'team_backfill', 'task', 'task_${id}', 0, 'station_backfill',
    '${JSON.stringify(reviewing === null ? {} : { reviewing })}'::jsonb,
    '${JSON.stringify({ repositories: config.map((name) => ({ name })) })}'::jsonb,
    'fingerprint', now()
  )`;

const recorded = (runId: string, repositories: readonly string[]): string => `
  INSERT INTO "run_record" ("run_id", "workspace_id", "repositories")
  VALUES ('${runId}', 'ws_backfill', '${JSON.stringify(repositories)}'::jsonb)`;

const repositoriesOf = async (
  table: 'dispatch' | 'run_record' | 'run_fact',
  runId: string,
): Promise<unknown> => {
  const key = table === 'dispatch' ? 'id' : 'run_id';
  const result = await database.db.execute<{ repositories: unknown }>(
    sql.raw(
      `SELECT "repositories" FROM "${table}" WHERE "${key}" = '${runId}'`,
    ),
  );

  return result.rows[0]?.repositories;
};

beforeAll(async () => {
  database = await openDatabase('run_repositories_backfill');

  await run(`
    INSERT INTO "line" ("id", "key", "workspace_id", "team_id", "name")
    VALUES ('line_backfill', 'delivery', 'ws_backfill', 'team_backfill', 'Delivery')`);
  await run(`
    INSERT INTO "line_repository" ("line_id", "repository")
    VALUES ('line_backfill', 'acme/api'), ('line_backfill', 'acme/Web')`);
  await run(`
    INSERT INTO "work_station" (
      "station_id", "workspace_id", "team_id", "line_id", "line_key", "line_name",
      "key", "name", "kind", "color", "position"
    ) VALUES (
      'station_backfill', 'ws_backfill', 'team_backfill', 'line_backfill', 'delivery', 'Delivery',
      'build', 'Build', 'work', 'blue', 0
    )`);

  await run(taskDispatch('run_partly_resolved', ['api', 'gone']));
  await run(recorded('run_partly_resolved', ['api', 'gone']));
  await run(`
    INSERT INTO "run_fact" (
      "run_id", "workspace_id", "team_id", "line_id", "station_id", "task_id", "harness",
      "repositories", "skills", "ended_at", "began_at", "ended_as", "ending", "resolution",
      "ran", "ran_a_config", "run_number", "asked", "usage_recorded", "dismissals", "memories"
    ) VALUES (
      'run_partly_resolved', 'ws_backfill', 'team_backfill', 'line_backfill', 'station_backfill',
      'task_run_partly_resolved', 'claude-code', '["api","gone"]'::jsonb, '[]'::jsonb, now(), now(),
      'completed', 'completed', 'accepted', true, true, 1, false, false, '[]'::jsonb, '{}'::jsonb
    )`);

  await run(taskDispatch('run_unresolved', ['gone']));
  await run(recorded('run_unresolved', ['gone']));

  await run(taskDispatch('run_recorded_empty', ['web']));
  await run(recorded('run_recorded_empty', []));

  await run(taskDispatch('run_reviewing', ['api', 'web'], 'acme/web'));
  await run(recorded('run_reviewing', ['acme/web']));

  await backfilled();
}, 60_000);

afterAll(async () => {
  await database.close();
});

describe('the backfill of the repositories a task run checked out', () => {
  it('names each repository its line still has by its full owner/name, on the dispatch, the record and the fact', async () => {
    expect(await repositoriesOf('dispatch', 'run_partly_resolved')).toEqual([
      'acme/api',
    ]);
    expect(await repositoriesOf('run_record', 'run_partly_resolved')).toEqual([
      'acme/api',
      'gone',
    ]);
    expect(await repositoriesOf('run_fact', 'run_partly_resolved')).toEqual([
      'acme/api',
      'gone',
    ]);
  });

  it('keeps the name a run recorded when its line no longer has that repository, so its spend stays attributed', async () => {
    expect(await repositoriesOf('dispatch', 'run_unresolved')).toEqual([]);
    expect(await repositoriesOf('run_record', 'run_unresolved')).toEqual([
      'gone',
    ]);
  });

  it('fills a record left empty by a run an earlier version ordered, from its dispatch', async () => {
    expect(await repositoriesOf('run_record', 'run_recorded_empty')).toEqual([
      'acme/Web',
    ]);
  });

  it('names the repository a review run reviewed as its line spells it', async () => {
    expect(await repositoriesOf('dispatch', 'run_reviewing')).toEqual([
      'acme/Web',
    ]);
    expect(await repositoriesOf('run_record', 'run_reviewing')).toEqual([
      'acme/Web',
    ]);
  });

  it('changes nothing when it runs again', async () => {
    await backfilled();

    expect(await repositoriesOf('run_record', 'run_partly_resolved')).toEqual([
      'acme/api',
      'gone',
    ]);
    expect(await repositoriesOf('run_record', 'run_unresolved')).toEqual([
      'gone',
    ]);
  });
});
