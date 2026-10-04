import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleRunnerActivityReader } from '@work/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

let held: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleRunnerActivityReader;

beforeAll(async () => {
  held = await openDatabase('runner_activity');
  db = held.db;
  reader = new DrizzleRunnerActivityReader(db);
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const heldRun = (over: Partial<typeof schema.run.$inferInsert>) => ({
  id: randomUUID(),
  workspaceId: 'ws_1',
  harness: 'dev',
  state: 'claimed' as const,
  spec: {},
  ...over,
});

describe('which run each busy runner is working on', () => {
  it('names a task run, a chat, a search and a run of a bare spec by what they are for, with their team', async () => {
    const lineId = randomUUID();
    const stationId = randomUUID();
    const taskId = randomUUID();
    const chatId = randomUUID();

    await db.insert(schema.line).values({
      id: lineId,
      key: `delivery-${lineId}`,
      workspaceId: 'ws_1',
      teamId: 'team_line',
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
    await db.insert(schema.chat).values({
      id: chatId,
      workspaceId: 'ws_1',
      teamId: 'team_chat',
      startedById: 'user_1',
      title: 'Plan the migration',
      harness: 'dev',
    });
    await db.insert(schema.run).values([
      heldRun({ taskId, stationId, claimedBy: 'runner_task' }),
      heldRun({ taskId, claimedBy: 'runner_task_no_station' }),
      heldRun({ claimedBy: 'runner_spec' }),
      heldRun({ chatId, claimedBy: 'runner_chat' }),
      heldRun({
        searchId: randomUUID(),
        ranForTeamId: 'team_search',
        claimedBy: 'runner_search',
      }),
      heldRun({
        taskId,
        stationId,
        state: 'completed',
        claimedBy: 'runner_done',
      }),
    ]);

    const busy = await reader.heldIn(WorkspaceId.of('ws_1'));

    expect(
      busy
        .map(({ runnerId, kind, teamId, title }) => ({
          runnerId,
          kind,
          teamId,
          title,
        }))
        .sort((one, other) => one.runnerId.localeCompare(other.runnerId)),
    ).toEqual([
      {
        runnerId: 'runner_chat',
        kind: 'chat',
        teamId: 'team_chat',
        title: 'Plan the migration',
      },
      {
        runnerId: 'runner_search',
        kind: 'search',
        teamId: 'team_search',
        title: null,
      },
      {
        runnerId: 'runner_spec',
        kind: 'spec',
        teamId: null,
        title: null,
      },
      {
        runnerId: 'runner_task',
        kind: 'task',
        teamId: 'team_line',
        title: 'Fix the queue',
      },
      {
        runnerId: 'runner_task_no_station',
        kind: 'task',
        teamId: 'team_line',
        title: 'Fix the queue',
      },
    ]);
  });
});
