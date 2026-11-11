import { randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type {
  InboxItemSummary,
  InboxRunSummary,
} from '@work/application/ports/inbox-reader.port';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { aRunOf, endingFor } from './support/run-ended';
import { aTurn, requestedBySpec, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('current_progress');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const progress = () => {
  const context = new DrizzleContext(db);
  const _noEvents = { dispatch: async () => {} };

  return new RunReadModel(new DrizzleRunFactsReader(context));
};

type RunState = (typeof schema.run.$inferInsert)['state'];

const inboxWith = async (
  state: RunState | null,
  {
    stopRequestedAt = null as Date | null,
    answered = true,
    asked = true,
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- widens the default to every turn
    turn = 'kept' as 'pending' | 'kept',
  } = {},
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
  await insertStations(db, {
    id: stationId,
    key: 'implementation',
    workspaceId: workspaceId,
    lineId,
    name: 'Implementation',
    position: 0,
  });
  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId,
    stationId,
    title: 'Fix the queue',
    assigneeId: viewer,
    currentRunId: runId,
  });
  if (state) {
    await db.insert(schema.run).values({
      ...requestedByTask(taskId),
      id: runId,
      workspaceId,
      harness: 'dev',
      state,
      ...endingFor(state),
      stopRequestedAt,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'Fix the queue.',
        handover: { options: ['done'], noteLimit: 0 },
        resume: {},
      },
      ...(state === 'claimed'
        ? {
            claimedBy: 'runner_1',
            leaseExpiresAt: new Date(Date.now() + 60_000),
          }
        : {}),
      ...(state === 'suspended' ? aTurn(turn) : {}),
    });
  }
  const askedBy = await aRunOf(db, {
    id: randomUUID(),
    workspaceId,
    taskId,
    state: 'completed',
  });
  const notes: (typeof schema.taskNote.$inferInsert)[] = [
    {
      taskId,
      position: 0,
      station: 'Implementation',
      stationId,
      body: 'Which queue?',
      at: new Date('2026-10-20T09:00:00.000Z'),
      voice: 'station',
      runId: askedBy,
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
    { findMany: async () => new Map() } as never,
    progress(),
  );
  const reader = new DrizzleInboxReader(
    db,
    { findMany: async () => new Map() } as never,
    progress(),
  );

  const entries = await reader.open({
    workspaceId,
    viewer: UserId.of(viewer),
    teamsSeen: new Set(['team_1']),
    teamsActedOn: new Set(),
  });

  const onBoard = await tasks.findInTeam(
    TeamId.of('team_1'),
    TaskId.of(taskId),
  );

  return {
    inbox: entries.find(
      (each): each is InboxItemSummary => each.kind === 'task',
    ),
    board: onBoard,
    running: entries.find(
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

  it('is in progress, not queued, while its task still decides what the run handed over (R12)', async () => {
    const { board, running } = await inboxWith('suspended', {
      asked: false,
      turn: 'pending',
    });

    expect(board?.progress).toBe('in-progress');
    expect(running?.progress).toBe('in-progress');
  });

  it('is stopping when a stop came in while its task still decides the turn', async () => {
    const { board } = await inboxWith('suspended', {
      asked: false,
      turn: 'pending',
      stopRequestedAt: new Date(),
    });

    expect(board?.progress).toBe('stopping');
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
        ...requestedBySpec(runId),
        id: runId,
        workspaceId: 'ws_1',
        harness: 'dev',
        state,
        ...endingFor(state),
        spec: {
          command: { executable: 'sh', args: [] },
          briefing: 'Fix the queue.',
          handover: { options: ['done'], noteLimit: 0 },
          resume: {},
        },
        ...(state === 'claimed'
          ? {
              claimedBy: 'runner_1',
              leaseExpiresAt: new Date(Date.now() + 60_000),
            }
          : {}),
      });
    }

    const {
      items: [found],
    } = await new DrizzleChatReader(
      db,
      { find: async () => null } as never,
      progress(),
    ).startedBy(TeamId.of('team_1'), UserId.of(viewer), FIRST_PAGE);

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
