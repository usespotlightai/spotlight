import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { RunReadModel } from '@runs/application/services/run-read-model.service';
import type { RunState } from '@runs/domain/value-objects/run-state';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { endingFor } from './support/run-ended';
import { runFactsOver } from './support/run-facts';
import { requestedByChat, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { insertTask } from './support/tasks';

let database: TestDatabase;
let db: DrizzleDatabase;
let chats: DrizzleChatRepository;
let leases: RunReadModel;
let traced: DrizzleTracedTaskReader;

beforeAll(async () => {
  database = await openDatabase('chat_traces');
  db = database.db;
  chats = new DrizzleChatRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  leases = runFactsOver(db);
  traced = new DrizzleTracedTaskReader(db);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const RUNNER = 'runner_1';

const RETRIES = TraceReference.of({
  taskId: TaskId.of('task_1'),
  title: TaskTitle.of('Retries back off'),
  teamId: TeamId.of('team_1'),
});

const started = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.fromInput('Why did this fail?'),
    traces: [RETRIES],
    now: new Date(),
    newId: () => randomUUID(),
  });

const chatRun = async (state: RunState) => {
  const chat = started();
  const runId = randomUUID();

  await chats.add(chat);
  await db.insert(schema.run).values({
    ...requestedByChat(chat.id.value, { teamId: 'team_1' }),
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    state,
    ...endingFor(state),
    claimedBy: state === 'claimed' ? RUNNER : null,
    leaseExpiresAt: state === 'claimed' ? new Date(Date.now() + 60_000) : null,
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Why did this fail?',
      handover: { options: ['done'], noteLimit: 0 },
      resume: {},
    },
  });

  return RunId.of(runId);
};

const taskOfTeam = async (teamId: string) => {
  const lineId = randomUUID();
  const stationId = randomUUID();
  const taskId = randomUUID();

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId: 'ws_1',
    teamId,
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
  await insertTask(db, {
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: 'ws_1',
    stationId,
    title: 'Fix the queue',
  });

  return { taskId, stationId };
};

const taskRun = async (teamId: string) => {
  const { taskId } = await taskOfTeam(teamId);
  const runId = randomUUID();

  await db.insert(schema.run).values({
    ...requestedByTask(taskId, { teamId }),
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    state: 'claimed',
    claimedBy: RUNNER,
    leaseExpiresAt: new Date(Date.now() + 60_000),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Why did this fail?',
      handover: { options: ['done'], noteLimit: 0 },
      resume: {},
    },
  });

  return RunId.of(runId);
};

describe('traces shared in a chat', () => {
  it('finds each task to share with its title and team, leaving out what is not there', async () => {
    const { taskId } = await taskOfTeam('team_2');

    expect(
      await traced.of([TaskId.of(taskId), TaskId.of(randomUUID())]),
    ).toEqual([{ taskId, title: 'Fix the queue', teamId: 'team_2' }]);
  });

  it('reads traces for the runner with the lease on a task run, as its line’s team', async () => {
    const runId = await taskRun('team_3');

    expect(
      (await leases.leasedBy(runId, RunnerId.of(RUNNER)))?.team?.value,
    ).toBe('team_3');
  });

  it('stores the traces a message shared', async () => {
    const chat = started();

    await chats.add(chat);
    const found = await chats.find(chat.id);

    expect(
      found?.messages[0]?.traces.map((each) => [
        each.taskId.value,
        each.title.value,
      ]),
    ).toEqual([['task_1', 'Retries back off']]);
  });

  it('reads traces for the runner with the lease on a chat run, as its chat’s team', async () => {
    const runId = await chatRun('claimed');

    expect(
      (await leases.leasedBy(runId, RunnerId.of(RUNNER)))?.team?.value,
    ).toBe('team_1');
  });

  it('reads nothing for another runner, or a chat run that has finished', async () => {
    const claimed = await chatRun('claimed');
    const finished = await chatRun('completed');

    await expect(
      leases.leasedBy(claimed, RunnerId.of('runner_2')),
    ).resolves.toBeNull();
    await expect(
      leases.leasedBy(finished, RunnerId.of(RUNNER)),
    ).resolves.toBeNull();
  });
});
