import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { RUNS, type RunsPort } from '@work/application/ports/runs.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';
import { eventually } from './support/eventually';
import { aDispatch } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const DELIVERY = randomUUID();
const BUILD = randomUUID();
const DENIED =
  'entitlement_expired: Catalog item catalog.web-search@1.1.0 requires the Team plan. The workspace’s Team plan has expired.';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `refused-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await insertStations(db, [
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a task run whose order the catalog refuses (e2e)', () => {
  it('ends the run failed and still writes the failure on the task', async () => {
    const taskId = randomUUID();
    const runId = randomUUID();

    await db.insert(schema.task).values({
      id: taskId,
      branch: `feat/test-${taskId}`,
      openedFrom: 'person',
      workspaceId: team.workspaceId.value,
      stationId: BUILD,
      title: 'Search the web',
      originStationId: BUILD,
      createdById: team.owner.value,
      assigneeId: team.owner.value,
      currentRunId: runId,
    });
    await db.insert(schema.dispatch).values(
      aDispatch({
        runId,
        workspaceId: team.workspaceId.value,
        teamId: team.teamId.value,
        taskId,
        stationId: BUILD,
      }),
    );

    const enqueued = await app.get<RunsPort>(RUNS).enqueue({
      runId,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      priority: 0,
      placement: { labelGroups: [], image: null },
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'Search the web.',
        handover: { options: [], noteLimit: 0 },
        resume: {},
        catalog: ['catalog.web-search@1.1.0'],
      },
      requester: WorkRequesters.task(
        TaskId.of(taskId),
        TaskRevision.of(0),
        team.teamId,
      ),
      policy: WorkRequesters.taskPolicy,
      workspace: WorkRequesters.taskWorkspace(TaskId.of(taskId)),
      restore: null,
      extensions: {},
      apiGrant: null,
      tags: { taskId },
      refusal: [{ description: DENIED }],
    });

    expect(enqueued.outcome).toBe('enqueued');

    const notes = await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      const written = await db
        .select({ body: schema.taskNote.body, runId: schema.taskNote.runId })
        .from(schema.taskNote)
        .where(eq(schema.taskNote.taskId, taskId));

      return written.length > 0 ? written : null;
    }, 30_000);

    const [run] = await db
      .select({ state: schema.run.state })
      .from(schema.run)
      .where(eq(schema.run.id, runId));
    expect(run?.state).toBe('failed');
    expect(notes).toEqual([
      expect.objectContaining({
        runId,
        body: expect.stringContaining('requires the Team plan'),
      }),
    ]);
  });
});
