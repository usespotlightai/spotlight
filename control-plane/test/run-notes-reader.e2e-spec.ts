import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let database: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleRunReader;

beforeAll(async () => {
  database = await openDatabase('run_notes_reader');
  db = database.db;
  reader = new DrizzleRunReader(
    db,
    { mayView: async () => true } as never,
    { findMany: async () => new Map() } as never,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const VIEWER = UserId.of('user_1');

type RunState = (typeof schema.run.$inferInsert)['state'];

const taskAtImplementation = async () => {
  const lineId = randomUUID();
  const triage = randomUUID();
  const implementation = randomUUID();
  const taskId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    { id: triage, key: 'triage', lineId, name: 'Triage', position: 0 },
    {
      id: implementation,
      key: 'implementation',
      lineId,
      name: 'Implementation',
      position: 1,
    },
  ]);
  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId: implementation,
    title: 'Fix the queue',
  });

  let position = 0;
  const note = (station: string, runId: string | null, body: string) =>
    db.insert(schema.taskNote).values({
      taskId,
      position: position++,
      station,
      body,
      at: new Date('2026-10-20T09:00:00.000Z'),
      voice: runId ? 'station' : 'person',
      authorId: runId ? null : 'user_1',
      runId,
      kind: 'message',
    });

  const run = async (
    stationId: string,
    state: RunState,
    createdAt: string,
    stopRequestedAt: Date | null = null,
  ) => {
    const id = randomUUID();
    await db.insert(schema.run).values({
      id,
      workspaceId: 'ws_1',
      harness: 'dev',
      taskId,
      stationId,
      state,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'Fix the queue.',
        handover: { options: ['done'], noteLimit: 0 },
        resume: { key: `${taskId}:${id}` },
      },
      createdAt: new Date(createdAt),
      stopRequestedAt,
    });
    return id;
  };

  return { taskId, triage, implementation, note, run };
};

const current = (taskId: string, runId: string) =>
  db
    .update(schema.task)
    .set({ currentRunId: runId })
    .where(eq(schema.task.id, taskId));

describe('the notes of a run', () => {
  it('shows the whole thread at the station of the run, from every run there', async () => {
    const { triage, implementation, note, run } = await taskAtImplementation();
    const triaged = await run(triage, 'completed', '2026-10-20T08:00:00.000Z');
    const first = await run(
      implementation,
      'failed',
      '2026-10-20T09:00:00.000Z',
    );
    const second = await run(
      implementation,
      'failed',
      '2026-10-20T10:00:00.000Z',
    );
    await note('Triage', triaged, 'triaged');
    await note('Implementation', first, 'it failed');
    await note('Implementation', null, 'try again');
    await note('Implementation', second, 'it failed again');

    const found = await reader.notesFor(RunId.of(first), VIEWER);

    expect(found?.notes.map((each) => each.body)).toEqual([
      'it failed',
      'try again',
      'it failed again',
    ]);
  });

  it('names the newest run of the task at the station', async () => {
    const { taskId, implementation, run } = await taskAtImplementation();
    const first = await run(
      implementation,
      'failed',
      '2026-10-20T09:00:00.000Z',
    );
    const second = await run(
      implementation,
      'claimed',
      '2026-10-20T10:00:00.000Z',
      new Date('2026-10-20T10:05:00.000Z'),
    );
    await current(taskId, second);

    const found = await reader.notesFor(RunId.of(first), VIEWER);

    expect(found?.latestRun).toEqual({
      id: second,
      state: 'claimed',
      stopping: true,
    });
    expect(found?.working).toBe(true);
  });

  it('no longer calls a run stopping once it has ended', async () => {
    const { implementation, run } = await taskAtImplementation();
    const stopped = await run(
      implementation,
      'cancelled',
      '2026-10-20T09:00:00.000Z',
      new Date('2026-10-20T09:05:00.000Z'),
    );

    const found = await reader.notesFor(RunId.of(stopped), VIEWER);

    expect(found?.latestRun.stopping).toBe(false);
  });

  it('does not work at the station once the task runs at another one', async () => {
    const { taskId, triage, implementation, run } =
      await taskAtImplementation();
    const here = await run(
      implementation,
      'completed',
      '2026-10-20T09:00:00.000Z',
    );
    const there = await run(triage, 'claimed', '2026-10-20T10:00:00.000Z');
    await current(taskId, there);

    const found = await reader.notesFor(RunId.of(here), VIEWER);

    expect(found?.latestRun).toEqual({
      id: here,
      state: 'completed',
      stopping: false,
    });
    expect(found?.working).toBe(false);
  });
});
