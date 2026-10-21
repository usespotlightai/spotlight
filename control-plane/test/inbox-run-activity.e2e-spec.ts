import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { InboxItemSummary } from '@work/application/ports/inbox-reader.port';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('inbox_run_activity');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

type RunState = (typeof schema.run.$inferInsert)['state'];

const inboxWith = async (
  state: RunState,
  stopRequestedAt: Date | null = null,
  answered = true,
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
  ]);

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

  return entries?.find(
    (each): each is InboxItemSummary => each.kind === 'task',
  );
};

describe('a task in the inbox whose run waits to start', () => {
  it('says its run is queued', async () => {
    const item = await inboxWith('queued');

    expect(item).toMatchObject({ activity: 'queued' });
  });

  it('is no longer queued once a runner claims the run', async () => {
    const item = await inboxWith('claimed');

    expect(item).toMatchObject({ activity: 'working' });
  });
});

describe('a task in the inbox whose run was asked to stop', () => {
  it('says its run is stopping once a person asks it to stop', async () => {
    const item = await inboxWith('claimed', new Date());

    expect(item).toMatchObject({ activity: 'stopping' });
  });

  it('says its run is stopping while it waited for a person', async () => {
    const item = await inboxWith('waiting', new Date());

    expect(item).toMatchObject({ activity: 'stopping' });
  });

  it('is no longer stopping once the run has ended', async () => {
    const item = await inboxWith('cancelled', new Date());

    expect(item).toMatchObject({ activity: null });
  });
});

describe('a task in the inbox whose run waits for a person', () => {
  it('says the run does nothing while it waits for the answer', async () => {
    const item = await inboxWith('waiting', null, false);

    expect(item).toMatchObject({ activity: null });
  });

  it('says the run does nothing while an ask is open, though a runner holds it', async () => {
    const item = await inboxWith('claimed', null, false);

    expect(item).toMatchObject({ activity: null });
  });

  it('says the run works again once the person answered', async () => {
    const item = await inboxWith('waiting');

    expect(item).toMatchObject({ activity: 'working' });
  });

  it('says the run is queued again once the person answered a suspended run', async () => {
    const item = await inboxWith('suspended');

    expect(item).toMatchObject({ activity: 'queued' });
  });
});
