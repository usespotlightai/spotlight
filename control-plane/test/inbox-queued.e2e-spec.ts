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
  database = await openDatabase('inbox_queued');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

type RunState = (typeof schema.run.$inferInsert)['state'];

const inboxWith = async (state: RunState) => {
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

    expect(item).toMatchObject({ working: true, queued: true });
  });

  it('is no longer queued once a runner claims the run', async () => {
    const item = await inboxWith('claimed');

    expect(item).toMatchObject({ working: true, queued: false });
  });
});
