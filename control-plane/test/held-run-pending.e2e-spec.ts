import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { DrizzleHeldRunReader } from '@work/infrastructure/persistence/drizzle/readers/held-run.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleHeldRunReader;

beforeAll(async () => {
  held = await openDatabase('held_run_pending');
  db = held.db;
  reader = new DrizzleHeldRunReader(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const RUNNER = RunnerId.of('runner_1');

const taskRun = async () => {
  const lineId = randomUUID();
  const stationId = randomUUID();
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    name: 'Delivery',
  });
  await db.insert(schema.station).values({
    id: stationId,
    key: 'triage',
    lineId,
    name: 'Triage',
    position: 0,
  });
  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId,
    title: 'Fix the queue',
    currentRunId: runId,
  });
  await db.insert(schema.taskNote).values({
    taskId,
    position: 0,
    station: 'Triage',
    body: 'Pin it to a version.',
    at: new Date('2026-09-17T09:00:00.000Z'),
    voice: 'person',
    authorId: 'user_1',
    kind: 'said',
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    taskId,
    stationId,
    state: 'claimed',
    claimedBy: RUNNER.value,
    spec: {},
  });

  return { taskId, runId: RunId.of(runId) };
};

describe('what a held run has yet to be told', () => {
  it('hands the run holding the task what a person said to it', async () => {
    const { runId } = await taskRun();

    const pending = await reader.pendingFor(runId, RUNNER);

    expect(pending?.map((each) => each.body)).toEqual(['Pin it to a version.']);
  });

  it('keeps what was said from a run the task has let go of', async () => {
    const { taskId, runId } = await taskRun();

    await db
      .update(schema.task)
      .set({ currentRunId: randomUUID() })
      .where(eq(schema.task.id, taskId));

    await expect(reader.pendingFor(runId, RUNNER)).resolves.toEqual([]);
  });

  it('hands the run exactly what its task says is undelivered, for every kind of note and voice', async () => {
    const { taskId, runId } = await taskRun();
    const kinds = ['asked', 'passed', 'answered', 'said'] as const;
    const voices = ['station', 'person', 'world'] as const;
    let position = 1;

    for (const kind of kinds) {
      for (const voice of voices) {
        for (const deliveredAt of [
          null,
          new Date('2026-09-17T10:00:00.000Z'),
        ]) {
          await db.insert(schema.taskNote).values({
            taskId,
            position: position++,
            station: 'Triage',
            body: `${kind} by ${voice}`,
            at: new Date('2026-09-17T09:30:00.000Z'),
            voice,
            authorId: voice === 'person' ? 'user_1' : null,
            kind,
            deliveredAt,
          });
        }
      }
    }

    const task = await new DrizzleTaskRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }).find(TaskId.of(taskId));
    const pending = await reader.pendingFor(runId, RUNNER);

    expect(pending?.map((each) => each.position)).toEqual(
      task?.undelivered.map((each) => each.position.value),
    );
    expect(pending?.length).toBeGreaterThan(1);
  });
});
