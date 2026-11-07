import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { requesterRefOf } from '@work/application/ports/run-requester-labels.port';
import { RunRequesterLabels } from '@work/application/services/run-requester-labels.service';
import { DrizzleRunnerActivityReader } from '@work/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { DrizzleWorkRequesterLabels } from '@work/infrastructure/persistence/drizzle/readers/work-requester-labels.reader';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import {
  requestedByChat,
  requestedBySearch,
  requestedBySpec,
  requestedByTask,
} from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';

let database: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleRunnerActivityReader;
let labels: RunRequesterLabels;

beforeAll(async () => {
  database = await openDatabase('runner_activity');
  db = database.db;
  reader = new DrizzleRunnerActivityReader(db);
  labels = new RunRequesterLabels();
  labels.register(new DrizzleWorkRequesterLabels(db));
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const leasedRun = (over: Partial<typeof schema.run.$inferInsert>) => ({
  id: randomUUID(),
  workspaceId: 'ws_1',
  harness: 'dev',
  state: 'claimed' as const,
  spec: {},
  ...requestedBySpec(randomUUID()),
  ...over,
});

describe('which run each busy runner is working on', () => {
  it('names a task run, a chat, a search and a run of a bare spec by the kind their requester names, with their team and the label of their requester', async () => {
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
      leasedRun({
        ...requestedByTask(taskId, { teamId: 'team_line' }),
        claimedBy: 'runner_task',
      }),
      leasedRun({ claimedBy: 'runner_spec' }),
      leasedRun({
        ...requestedByChat(chatId, { teamId: 'team_chat' }),
        claimedBy: 'runner_chat',
      }),
      leasedRun({
        ...requestedBySearch(
          { runId: randomUUID(), searchId: randomUUID() },
          'team_search',
        ),
        claimedBy: 'runner_search',
      }),
      leasedRun({
        ...requestedByTask(taskId, { teamId: 'team_line' }),
        state: 'completed',
        endedAt: new Date(),
        claimedBy: 'runner_done',
      }),
    ]);

    const busy = await reader.leasedIn(WorkspaceId.of('ws_1'));
    const titles = await labels.labelsOf(busy.map((each) => each.requester));

    expect(
      busy
        .map(({ runnerId, requester, teamId }) => ({
          runnerId,
          kind: requester.kind,
          teamId,
          title: titles.get(requesterRefOf(requester))?.title ?? null,
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
    ]);
  });
});
