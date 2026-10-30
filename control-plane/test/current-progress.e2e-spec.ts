import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  InboxItemSummary,
  InboxRunSummary,
} from '@work/application/ports/inbox-reader.port';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('current_progress');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

type RunState = (typeof schema.run.$inferInsert)['state'];

const inboxWith = async (
  state: RunState | null,
  { stopRequestedAt = null as Date | null, answered = true, asked = true } = {},
) => {
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
      stopRequestedAt,
      spec: {},
    });
  }
  const notes: (typeof schema.taskNote.$inferInsert)[] = [
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
    ...(answered
      ? [
          {
            taskId,
            position: 1,
            station: 'Implementation',
            stationId,
            body: 'The retry queue.',
            at: new Date('2026-10-20T09:05:00.000Z'),
            voice: 'person' as const,
            authorId: viewer,
            kind: 'answered' as const,
          },
        ]
      : []),
  ];
  if (asked) {
    await db.insert(schema.taskNote).values(notes);
  }

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
    running: entries?.find(
      (each): each is InboxRunSummary => each.kind === 'run',
    ),
  };
};

describe('the progress of a task whose run waits to start', () => {
  it('is queued before the run is even on the queue', async () => {
    const { inbox, board } = await inboxWith(null);

    expect(inbox?.progress).toBe('queued');
    expect(board?.progress).toBe('queued');
  });

  it('is queued while the run waits for a runner', async () => {
    const { inbox, board } = await inboxWith('queued');

    expect(inbox?.progress).toBe('queued');
    expect(board?.progress).toBe('queued');
  });

  it('is in progress once a runner claims the run', async () => {
    const { inbox, board } = await inboxWith('claimed');

    expect(inbox?.progress).toBe('in-progress');
    expect(board?.progress).toBe('in-progress');
  });
});

describe('the progress of a task whose run was asked to stop', () => {
  it('is stopping while the run has not ended', async () => {
    const { inbox, board } = await inboxWith('claimed', {
      stopRequestedAt: new Date(),
    });

    expect(inbox?.progress).toBe('stopping');
    expect(board?.progress).toBe('stopping');
  });

  it('is none once the run has ended', async () => {
    const { inbox, board } = await inboxWith('cancelled', {
      stopRequestedAt: new Date(),
    });

    expect(inbox?.progress).toBeNull();
    expect(board?.progress).toBeNull();
  });
});

describe('the progress of a task whose run was suspended for a person', () => {
  it('is none while the person owes an answer', async () => {
    const { inbox, board } = await inboxWith('suspended', { answered: false });

    expect(inbox?.progress).toBeNull();
    expect(board?.progress).toBeNull();
  });

  it('is queued again once the person answered a suspended run', async () => {
    const { inbox, board } = await inboxWith('suspended');

    expect(inbox?.progress).toBe('queued');
    expect(board?.progress).toBe('queued');
  });
});

describe('a run on a task with nothing to ask its person', () => {
  it('stands in the inbox on its own while it works', async () => {
    const { inbox, running } = await inboxWith('claimed', { asked: false });

    expect(inbox).toBeUndefined();
    expect(running).toMatchObject({
      kind: 'run',
      title: 'Fix the queue',
      station: 'Implementation',
      progress: 'in-progress',
    });
  });

  it('is queued while it waits for a runner', async () => {
    const { running } = await inboxWith('queued', { asked: false });

    expect(running?.progress).toBe('queued');
  });

  it('leaves the inbox once it has ended', async () => {
    const { running } = await inboxWith('completed', { asked: false });

    expect(running).toBeUndefined();
  });

  it('stays out where the run has a conversation open', async () => {
    const { inbox, running } = await inboxWith('suspended');

    expect(inbox?.progress).toBe('queued');
    expect(running).toBeUndefined();
  });
});

describe('the progress of a chat whose run waits to start', () => {
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

    return found?.progress;
  };

  it('is queued before the run is even on the queue', async () => {
    await expect(chatWith(null)).resolves.toBe('queued');
  });

  it('is in progress once a runner claims the run', async () => {
    await expect(chatWith('claimed')).resolves.toBe('in-progress');
  });

  it('is none while the chat waits for the next message', async () => {
    await expect(chatWith('completed')).resolves.toBeNull();
  });
});
