import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunnerTraceReader } from '@work/infrastructure/persistence/drizzle/readers/runner-trace.reader';
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
    {
      mayView: async () => true,
      viewableBy: async (_viewer: unknown, ids: readonly { value: string }[]) =>
        new Set(ids.map((id) => id.value)),
    } as never,
    { findMany: async () => new Map() } as never,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const VIEWER = UserId.of('user_1');

type RunState = (typeof schema.run.$inferInsert)['state'];

const taskOnLine = async (...names: string[]) => {
  const lineId = randomUUID();
  const stations = names.map(() => randomUUID());
  const taskId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await db.insert(schema.station).values(
    names.map((name, position) => ({
      id: stations[position],
      key: `station-${position}`,
      lineId,
      name,
      position,
    })),
  );
  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId: stations[stations.length - 1],
    title: 'Fix the queue',
  });

  let position = 0;
  const note = (
    at: { stationId: string; station: string },
    runId: string | null,
    body: string,
    kind: 'message' | 'asked' | 'answered' = 'message',
  ) =>
    db.insert(schema.taskNote).values({
      taskId,
      position: position++,
      station: at.station,
      stationId: at.stationId,
      body,
      at: new Date('2026-10-20T09:00:00.000Z'),
      voice: runId ? 'station' : 'person',
      authorId: runId ? null : 'user_1',
      runId,
      kind,
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

  return { taskId, stations, note, run };
};

const taskAtImplementation = async () => {
  const { stations, ...rest } = await taskOnLine('Triage', 'Implementation');
  const [triage, implementation] = stations;

  return { ...rest, triage, implementation };
};

const bodiesOf = async (runId: string) =>
  (await reader.notesFor(RunId.of(runId), VIEWER))?.notes.map(
    (each) => each.body,
  );

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
    const atTriage = { stationId: triage, station: 'Triage' };
    const atImplementation = {
      stationId: implementation,
      station: 'Implementation',
    };
    await note(atTriage, triaged, 'triaged');
    await note(atImplementation, first, 'it failed');
    await note(atImplementation, null, 'try again');
    await note(atImplementation, second, 'it failed again');

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
      activity: 'stopping',
    });
  });

  it('calls a run stopping that was stopped while it waited for a person', async () => {
    const { implementation, run } = await taskAtImplementation();
    const waiting = await run(
      implementation,
      'waiting',
      '2026-10-20T09:00:00.000Z',
      new Date('2026-10-20T09:05:00.000Z'),
    );

    const found = await reader.notesFor(RunId.of(waiting), VIEWER);

    expect(found?.latestRun.activity).toBe('stopping');
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

    expect(found?.latestRun.activity).toBeNull();
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
      activity: null,
    });
  });

  it('keeps the notes written before the station was renamed', async () => {
    const { implementation, note, run } = await taskAtImplementation();
    await note(
      { stationId: implementation, station: 'Implementation' },
      null,
      'typed before the rename',
    );
    await db
      .update(schema.station)
      .set({ name: 'Build' })
      .where(eq(schema.station.id, implementation));
    const built = await run(
      implementation,
      'completed',
      '2026-10-20T09:00:00.000Z',
    );
    await note(
      { stationId: implementation, station: 'Build' },
      built,
      'ran after the rename',
    );

    expect(await bodiesOf(built)).toEqual([
      'typed before the rename',
      'ran after the rename',
    ]);
  });

  it('places a note at its station after the station is renamed', async () => {
    const { implementation, note, run } = await taskAtImplementation();
    const built = await run(
      implementation,
      'completed',
      '2026-10-20T09:00:00.000Z',
    );
    await db
      .update(schema.station)
      .set({ name: 'Build' })
      .where(eq(schema.station.id, implementation));
    await note(
      { stationId: implementation, station: 'Implementation' },
      built,
      'ran before the rename',
    );

    const [shown] =
      (await reader.notesFor(RunId.of(built), VIEWER))?.notes ?? [];

    expect(shown).toMatchObject({
      station: 'Implementation',
      stationPosition: 1,
    });
  });

  it('keeps apart two stations with the same name', async () => {
    const {
      stations: [first, second],
      note,
      run,
    } = await taskOnLine('Review', 'Review');
    const firstRun = await run(first, 'completed', '2026-10-20T09:00:00.000Z');
    await note(
      { stationId: first, station: 'Review' },
      null,
      'typed at the first review',
    );
    await note(
      { stationId: first, station: 'Review' },
      firstRun,
      'ran at the first review',
    );
    const secondRun = await run(
      second,
      'completed',
      '2026-10-20T10:00:00.000Z',
    );
    await note(
      { stationId: second, station: 'Review' },
      null,
      'typed at the second review',
    );
    await note(
      { stationId: second, station: 'Review' },
      secondRun,
      'ran at the second review',
    );

    expect(await bodiesOf(firstRun)).toEqual([
      'typed at the first review',
      'ran at the first review',
    ]);
    expect(await bodiesOf(secondRun)).toEqual([
      'typed at the second review',
      'ran at the second review',
    ]);
  });
});

describe('the activity of a run', () => {
  const IMPLEMENTATION = { station: 'Implementation' };

  const listed = async (taskId: string, runId: string) => {
    const [forTask, forTeam, traced] = await Promise.all([
      reader.listForTask(TaskId.of(taskId), VIEWER),
      reader.listForTeam(TeamId.of('team_1'), VIEWER),
      new DrizzleRunnerTraceReader(db).runsForTask(TaskId.of(taskId)),
    ]);

    return [forTask, forTeam, traced].map(
      (runs) => runs.find((each) => each.id === runId)?.activity,
    );
  };

  it('says nothing for a run a runner holds while a person owes an answer', async () => {
    const { taskId, implementation, note, run } = await taskAtImplementation();
    const held = await run(
      implementation,
      'claimed',
      '2026-10-20T09:00:00.000Z',
    );
    await current(taskId, held);
    await note(
      { ...IMPLEMENTATION, stationId: implementation },
      held,
      'May I drop the table?',
      'asked',
    );

    const found = await reader.notesFor(RunId.of(held), VIEWER);

    expect(found?.latestRun.activity).toBeNull();
    expect(await listed(taskId, held)).toEqual([null, null, null]);
  });

  it('says a paused run works again once the person answered', async () => {
    const { taskId, implementation, note, run } = await taskAtImplementation();
    const paused = await run(
      implementation,
      'waiting',
      '2026-10-20T09:00:00.000Z',
    );
    await current(taskId, paused);
    await note(
      { ...IMPLEMENTATION, stationId: implementation },
      paused,
      'Which queue?',
      'asked',
    );
    await note(
      { ...IMPLEMENTATION, stationId: implementation },
      null,
      'The retry queue.',
      'answered',
    );

    const found = await reader.notesFor(RunId.of(paused), VIEWER);

    expect(found?.latestRun.activity).toBe('working');
    expect(await listed(taskId, paused)).toEqual([
      'working',
      'working',
      'working',
    ]);
  });

  it('lists a run asked to stop as stopping, and an older paused run as doing nothing', async () => {
    const { taskId, triage, implementation, run } =
      await taskAtImplementation();
    const older = await run(triage, 'suspended', '2026-10-20T09:00:00.000Z');
    const stopping = await run(
      implementation,
      'claimed',
      '2026-10-20T10:00:00.000Z',
      new Date('2026-10-20T10:05:00.000Z'),
    );
    await current(taskId, stopping);

    expect(await listed(taskId, stopping)).toEqual([
      'stopping',
      'stopping',
      'stopping',
    ]);
    expect(await listed(taskId, older)).toEqual([null, null, null]);
  });
});
