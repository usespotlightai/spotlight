import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { DrizzleRunnerTraceReader } from '@work/infrastructure/persistence/drizzle/readers/runner-trace.reader';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let chats: DrizzleChatRepository;
let traces: DrizzleRunnerTraceReader;
let traced: DrizzleTracedTaskReader;

beforeAll(async () => {
  held = await openDatabase('chat_traces');
  db = held.db;
  chats = new DrizzleChatRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  traces = new DrizzleRunnerTraceReader(db);
  traced = new DrizzleTracedTaskReader(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const RUNNER = 'runner_1';

const RETRIES = TraceReference.of({
  taskId: TaskId.of('task_1'),
  title: TaskTitle.of('Retries back off'),
  teamId: TeamId.of('team_1'),
});

const started = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.given('Why did this fail?'),
    traces: [RETRIES],
    now: new Date(),
    newId: () => randomUUID(),
  });

const chatRun = async (state: RunState) => {
  const chat = started();
  const runId = randomUUID();

  await chats.add(chat);
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    chatId: chat.id.value,
    state,
    claimedBy: RUNNER,
    spec: {},
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
  });

  return { taskId, stationId };
};

const taskRun = async (teamId: string) => {
  const { taskId, stationId } = await taskOfTeam(teamId);
  const runId = randomUUID();

  await db.insert(schema.run).values({
    id: runId,
    workspaceId: 'ws_1',
    harness: 'dev',
    taskId,
    stationId,
    state: 'claimed',
    claimedBy: RUNNER,
    spec: {},
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

  it('reads traces for the runner holding a task run, as its line’s team', async () => {
    const runId = await taskRun('team_3');

    expect(
      (await traces.heldRunStanding(runId, RunnerId.of(RUNNER)))?.teamId.value,
    ).toBe('team_3');
  });

  it('keeps the traces a message shared', async () => {
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

  it('reads traces for the runner holding a chat run, as its chat’s team', async () => {
    const runId = await chatRun('claimed');

    expect(
      (await traces.heldRunStanding(runId, RunnerId.of(RUNNER)))?.teamId.value,
    ).toBe('team_1');
  });

  it('reads nothing for another runner, or a chat run that has finished', async () => {
    const claimed = await chatRun('claimed');
    const finished = await chatRun('completed');

    await expect(
      traces.heldRunStanding(claimed, RunnerId.of('runner_2')),
    ).resolves.toBeNull();
    await expect(
      traces.heldRunStanding(finished, RunnerId.of(RUNNER)),
    ).resolves.toBeNull();
  });
});
