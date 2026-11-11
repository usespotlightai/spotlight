import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { RunWorks } from '@work/application/services/run-works.service';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { aDispatch } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

let database: TestDatabase;
let db: DrizzleDatabase;
let works: RunWorks;

const NO_EVENTS = { dispatch: async () => {} };

beforeAll(async () => {
  database = await openDatabase('leased_run_pending');
  db = database.db;
  const context = new DrizzleContext(db);
  works = new RunWorks(
    new RunReadModel(new DrizzleRunFactsReader(context)),
    {} as RunsPort,
    new DrizzleTaskRepository(context, NO_EVENTS),
    new DrizzleChatRepository(context, NO_EVENTS),
    {} as LineMapsPort,
    new DrizzleDispatchRepository(context, NO_EVENTS),
    { now: () => new Date(), sleep: async () => {} },
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
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
  await insertStations(db, {
    id: stationId,
    key: 'triage',
    workspaceId: 'ws_1',
    lineId,
    name: 'Triage',
    position: 0,
  });
  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
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
    stationId,
    body: 'Pin it to a version.',
    at: new Date('2026-09-17T09:00:00.000Z'),
    voice: 'person',
    authorId: 'user_1',
    kind: 'message',
  });
  await leasedRun(runId, { kind: 'task', id: taskId, token: '0' });
  await db
    .insert(schema.dispatch)
    .values(aDispatch({ runId, taskId, stationId }));

  return { taskId, stationId, runId };
};

const leasedRun = (
  runId: string,
  requester: { kind: string; id: string; token: string | null },
) =>
  db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    requesterOwner: 'work',
    requesterKind: requester.kind,
    requesterId: requester.id,
    requesterToken: requester.token,
    holdsTurn: requester.kind === 'task',
    gated: requester.kind === 'task',
    actsBeyondItself: true,
    asks: 'requester',
    listed: true,
    exclusive: true,
    state: 'claimed',
    claimedBy: RUNNER.value,
    leaseExpiresAt: new Date(Date.now() + 60 * 60_000),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    },
  });

const chatRun = async () => {
  const chatId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: 'ws_1',
    teamId: 'team_1',
    title: 'Plan the queue',
    startedById: 'user_1',
    harness: 'dev',
    currentRunId: runId,
  });
  await db.insert(schema.chatMessage).values([
    {
      chatId,
      position: 0,
      kind: 'message',
      body: 'Plan how retries back off.',
      authorId: 'user_1',
      at: new Date('2026-09-17T09:00:00.000Z'),
      acknowledgedAt: new Date('2026-09-17T09:01:00.000Z'),
      acknowledgedByRunId: runId,
    },
    {
      chatId,
      position: 1,
      kind: 'message',
      body: 'And the dead letters?',
      authorId: 'user_1',
      at: new Date('2026-09-17T09:05:00.000Z'),
    },
  ]);
  await leasedRun(runId, { kind: 'chat', id: chatId, token: null });
  await db.insert(schema.dispatch).values(aDispatch({ runId, chatId }));

  return { runId };
};

describe('the messages that a leased run has yet to get', () => {
  it('hands the current run of the task the messages that a person sent to it', async () => {
    const { runId } = await taskRun();

    const pending = await works.pendingFor(runId, RUNNER.value);

    expect(pending?.map((each) => each.body)).toEqual(['Pin it to a version.']);
  });

  it('keeps the messages from a run that the task has detached', async () => {
    const { taskId, runId } = await taskRun();

    await db
      .update(schema.task)
      .set({ currentRunId: randomUUID() })
      .where(eq(schema.task.id, taskId));

    await expect(works.pendingFor(runId, RUNNER.value)).resolves.toEqual([]);
  });

  it('hands the run exactly the notes that its task has not acknowledged, for every kind of note and voice', async () => {
    const { taskId, stationId, runId } = await taskRun();
    const kinds = ['asked', 'passed', 'answered', 'message'] as const;
    const voices = ['station', 'person', 'world'] as const;
    let position = 1;

    for (const kind of kinds) {
      for (const voice of voices) {
        for (const acknowledgedAt of [
          null,
          new Date('2026-09-17T10:00:00.000Z'),
        ]) {
          await db.insert(schema.taskNote).values({
            taskId,
            position: position++,
            station: 'Triage',
            stationId,
            body: `${kind} by ${voice}`,
            at: new Date('2026-09-17T09:30:00.000Z'),
            voice,
            authorId: voice === 'person' ? 'user_1' : null,
            kind,
            acknowledgedAt,
          });
        }
      }
    }

    const task = await new DrizzleTaskRepository(new DrizzleContext(db), {
      dispatch: async () => {},
    }).find(TaskId.of(taskId));
    const pending = await works.pendingFor(runId, RUNNER.value);

    expect(pending?.map((each) => each.position)).toEqual(
      task?.unacknowledged.map((each) => each.position.value),
    );
    expect(pending?.length).toBeGreaterThan(1);
  });

  it('hands a chat run the messages of the chat it has not acknowledged', async () => {
    const { runId } = await chatRun();

    const pending = await works.pendingFor(runId, RUNNER.value);

    expect(pending?.map((each) => each.body)).toEqual([
      'And the dead letters?',
    ]);
  });

  it('answers nothing to a runner that does not lease the run', async () => {
    const { runId } = await taskRun();

    await expect(works.pendingFor(runId, 'runner_2')).resolves.toBeNull();
  });
});
