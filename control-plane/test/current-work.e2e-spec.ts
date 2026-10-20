import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxItemSummary } from '@work/application/ports/inbox-reader.port';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('current_work');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

type RunState = (typeof schema.run.$inferInsert)['state'];

const inboxWith = async (state: RunState | null) => {
  const workspaceId = randomUUID();
  const lineId = randomUUID();
  const stationId = randomUUID();
  const taskId = randomUUID();
  const runId = randomUUID();
  const viewer = `user_${randomUUID()}`;

  await db.insert(schema.line).values({
    id: lineId,
    key: `delivery-${lineId}`,
    workspaceId,
    teamId: 'team_1',
    name: 'Delivery',
  });
  await db.insert(schema.station).values({
    id: stationId,
    key: 'implementation',
    lineId,
    name: 'Implementation',
    position: 0,
  });
  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId,
    stationId,
    title: 'Fix the queue',
    assigneeId: viewer,
    currentRunId: runId,
  });
  if (state) {
    await db.insert(schema.run).values({
      id: runId,
      workspaceId,
      harness: 'dev',
      taskId,
      stationId,
      state,
      spec: {},
    });
  }
  await db.insert(schema.taskNote).values([
    {
      taskId,
      position: 0,
      station: 'Implementation',
      stationId,
      body: 'Which queue?',
      at: new Date('2026-10-20T09:00:00.000Z'),
      voice: 'station',
      runId: randomUUID(),
      kind: 'asked',
    },
    {
      taskId,
      position: 1,
      station: 'Implementation',
      stationId,
      body: 'The retry queue.',
      at: new Date('2026-10-20T09:05:00.000Z'),
      voice: 'person',
      authorId: viewer,
      kind: 'answered',
    },
  ]);

  const tasks = new DrizzleTaskReader(
    db,
    { mayView: async () => true } as never,
    {
      find: async () => ({ workspaceId: WorkspaceId.of(workspaceId) }),
    } as never,
    { findMany: async () => new Map() } as never,
  );
  const reader = new DrizzleInboxReader(
    db,
    { mayView: async () => true, onTeam: async () => null } as never,
    { idForSlug: async () => workspaceId } as never,
    { findMany: async () => new Map() } as never,
  );

  const entries = await reader.listForWorkspaceMember(
    'acme',
    UserId.of(viewer),
    new Date(0),
  );

  const onBoard = await tasks.findForTeamMember(
    TeamId.of('team_1'),
    UserId.of(viewer),
    TaskId.of(taskId),
  );

  return {
    inbox: entries?.find(
      (each): each is InboxItemSummary => each.kind === 'task',
    ),
    board: onBoard,
  };
};

describe('the work of a task whose run waits to start', () => {
  it('is queued before the run is even on the queue', async () => {
    const { inbox, board } = await inboxWith(null);

    expect(inbox?.work).toBe('queued');
    expect(board?.work).toBe('queued');
  });

  it('is queued while the run waits for a runner', async () => {
    const { inbox, board } = await inboxWith('queued');

    expect(inbox?.work).toBe('queued');
    expect(board?.work).toBe('queued');
  });

  it('is in progress once a runner claims the run', async () => {
    const { inbox, board } = await inboxWith('claimed');

    expect(inbox?.work).toBe('in-progress');
    expect(board?.work).toBe('in-progress');
  });
});

describe('the work of a chat whose run waits to start', () => {
  const chatWith = async (state: RunState | null) => {
    const chatId = randomUUID();
    const runId = randomUUID();
    const viewer = `user_${randomUUID()}`;

    await db.insert(schema.chat).values({
      id: chatId,
      workspaceId: 'ws_1',
      teamId: 'team_1',
      startedById: viewer,
      title: 'Rate limiting',
      harness: 'dev',
      currentRunId: runId,
    });

    if (state) {
      await db.insert(schema.run).values({
        id: runId,
        workspaceId: 'ws_1',
        harness: 'dev',
        state,
        spec: {},
      });
    }

    const [found] = await new DrizzleChatReader(db, {
      find: async () => null,
    } as never).startedBy(TeamId.of('team_1'), UserId.of(viewer));

    return found?.work;
  };

  it('is queued before the run is even on the queue', async () => {
    await expect(chatWith(null)).resolves.toBe('queued');
  });

  it('is in progress once a runner claims the run', async () => {
    await expect(chatWith('claimed')).resolves.toBe('in-progress');
  });
});
