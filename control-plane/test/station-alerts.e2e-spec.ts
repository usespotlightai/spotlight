import { randomUUID } from 'node:crypto';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { DrizzleStationAlertStateRepository } from '@insights/infrastructure/persistence/drizzle/repositories/station-alert-state.repository';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_ACTED_ON,
  type TaskActedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  resume: { key: 'task:station' },
};

const MINUTE = 60_000;

const NOW = Date.now();

const ago = (minutes: number) => new Date(NOW - minutes * MINUTE);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let elsewhere: Awaited<ReturnType<typeof createTeam>>;

const inboxRequestOf = async (taskId: string) => {
  const [inboxRequest] = await db
    .select()
    .from(schema.inboxRequest)
    .where(
      and(
        eq(schema.inboxRequest.taskId, taskId),
        eq(schema.inboxRequest.form, 'alert'),
      ),
    );

  return inboxRequest ?? null;
};

const ranAndEnded = async (minutesAgo: number) => {
  const runId = randomUUID();

  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    taskId: team.list.id.value,
    taskRevision: 0,
    stationId: team.stationId.value,
    state: 'completed',
    spec: SPEC,
    stationFingerprint: 'a'.repeat(64),
    stationConfig: {
      prompt: 'Implement the task.',
      harness: 'claude-code',
      model: 'sonnet',
      effort: null,
      profile: null,
      image: null,
      repositories: [],
      skills: [],
      tools: [],
      decisions: false,
      memories: false,
    },
    createdAt: ago(minutesAgo + 5),
    startedAt: ago(minutesAgo + 4),
    endedAt: ago(minutesAgo),
  });

  const ended: RunEndedIntegrationEvent = {
    kind: RUN_ENDED,
    runId,
    workspaceId: team.workspaceId.value,
    taskId: team.list.id.value,
    stationId: team.stationId.value,
    outcome: 'completed',
    failure: null,
    stopped: false,
    asked: false,
  };

  await app.get(EventOutbox).record([ended as never]);

  return runId;
};

const actedOn = async (
  runId: string,
  act: 'sent-back' | 'accepted',
  minutesAgo: number,
) => {
  const acted: TaskActedOnIntegrationEvent = {
    kind: TASK_ACTED_ON,
    taskId: team.list.id.value,
    workspaceId: team.workspaceId.value,
    stationId: team.stationId.value,
    action: act,
    by: team.owner.value,
    afterRunId: runId,
    at: ago(minutesAgo).toISOString(),
    tool: null,
    server: null,
  };

  await app.get(EventOutbox).record([acted as never]);
};

const eventuallyFound = async <T>(read: () => Promise<T | null | undefined>) =>
  eventually(async () => {
    await app.get(EventDelivery).drain(2_000);
    return read();
  }, 60_000);

const alertsAtStation = () =>
  db
    .select()
    .from(schema.stationAlert)
    .where(eq(schema.stationAlert.stationId, team.stationId.value));

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  const tasks = app.get(DrizzleTaskRepository);
  team = await createTeam(db, tasks, `alerts-${randomUUID().slice(0, 8)}`);
  elsewhere = await createTeam(
    db,
    tasks,
    `elsewhere-${randomUUID().slice(0, 8)}`,
  );

  await db
    .update(schema.station)
    .set({
      alerts: [
        {
          measure: 'accepted_rate',
          risesBy: null,
          above: null,
          fallsBy: null,
          below: 0.5,
          over: 1,
        },
      ],
    })
    .where(eq(schema.station.id, team.stationId.value));
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a station alert (e2e)', () => {
  it('creates an inbox request on the task whose run crossed the station’s threshold once a person answered it, and shows it', async () => {
    const runId = await ranAndEnded(10);
    await eventuallyFound(async () => {
      const [record] = await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId));
      return record?.endedAt;
    });
    expect(await inboxRequestOf(team.list.id.value)).toBeNull();

    await actedOn(runId, 'sent-back', 9);

    const inboxRequest = await eventuallyFound(() =>
      inboxRequestOf(team.list.id.value),
    );

    const answer = await served(app)
      .get(
        `/api/teams/${team.teamId.value}/insights/alerts/${inboxRequest.about}`,
      )
      .set(TEST_USER_HEADER, team.owner.value);

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      stationId: team.stationId.value,
      runId,
      taskId: team.list.id.value,
      value: 0,
      baseline: null,
      rule: { measure: 'accepted_rate', below: 0.5, over: 1 },
      resolvedAt: null,
    });
    expect(answer.body.series).toEqual([
      expect.objectContaining({ runId, value: 0 }),
    ]);

    const inbox = await served(app)
      .get(`/api/workspaces/${team.slug}/inbox`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(inbox.status).toBe(200);
    expect(
      (
        inbox.body as { inboxRequest: { form: string; about: string } | null }[]
      ).some(
        (each) =>
          each.inboxRequest?.form === 'alert' &&
          each.inboxRequest.about === inboxRequest.about,
      ),
    ).toBe(true);
  });

  it('creates no second inbox request while the station stays past the threshold, nor on a run nobody answered yet', async () => {
    const runId = await ranAndEnded(5);
    await eventuallyFound(async () => {
      const [record] = await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId));
      return record?.endedAt;
    });
    await app.get(EventDelivery).drain(2_000);
    await app.get(EventDelivery).drain(2_000);

    const inboxRequests = await db
      .select()
      .from(schema.inboxRequest)
      .where(eq(schema.inboxRequest.form, 'alert'));
    const alerts = await alertsAtStation();

    expect(
      inboxRequests.filter((each) => each.taskId === team.list.id.value),
    ).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.resolvedAt).toBeNull();
  });

  it('resolves once a person accepts the run that ended unanswered', async () => {
    const [unanswered] = await db
      .select()
      .from(schema.runRecord)
      .where(
        and(
          eq(schema.runRecord.stationId, team.stationId.value),
          isNull(schema.runRecord.firstHumanAction),
        ),
      );

    await actedOn(unanswered?.runId as string, 'accepted', 4);

    const [recovered] = await eventuallyFound(async () => {
      const alerts = await alertsAtStation();
      return alerts[0]?.resolvedAt ? alerts : null;
    });

    expect(recovered?.resolvedAt).not.toBeNull();
  });

  it('resolves the inbox request when the alert resolves, and reopens the same alert and inbox request when the station crosses again soon after', async () => {
    const [recovered] = await alertsAtStation();
    const resolvedRequest = await eventuallyFound(async () => {
      const inboxRequest = await inboxRequestOf(team.list.id.value);
      return inboxRequest?.resolvedAt ? inboxRequest : null;
    });

    const runId = await ranAndEnded(3);
    await eventuallyFound(async () => {
      const [record] = await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId));
      return record?.endedAt;
    });
    await actedOn(runId, 'sent-back', 2);

    const [reopened] = await eventuallyFound(async () => {
      const alerts = await alertsAtStation();
      return alerts[0]?.resolvedAt === null ? alerts : null;
    });
    const inboxRequest = await eventuallyFound(async () => {
      const found = await inboxRequestOf(team.list.id.value);
      return found && found.resolvedAt === null ? found : null;
    });

    expect(await alertsAtStation()).toHaveLength(1);
    expect(reopened?.id).toBe(recovered?.id);
    expect(inboxRequest.id).toBe(resolvedRequest.id);
  });

  it('resolves at once when the line no longer sets the threshold', async () => {
    await db
      .update(schema.station)
      .set({ alerts: [] })
      .where(eq(schema.station.id, team.stationId.value));
    const updated: LineChangedIntegrationEvent = {
      kind: LINE_CHANGED,
      lineId: team.line.id.value,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      stationIds: [team.stationId.value],
    };
    await app.get(EventOutbox).record([updated as never]);

    const [recovered] = await eventuallyFound(async () => {
      const alerts = await alertsAtStation();
      return alerts[0]?.resolvedAt ? alerts : null;
    });

    expect(recovered?.resolvedAt).not.toBeNull();
  });

  it('finds no alert for another team', async () => {
    const [alert] = await db
      .select()
      .from(schema.stationAlert)
      .where(eq(schema.stationAlert.stationId, team.stationId.value));

    const answer = await served(app)
      .get(`/api/teams/${elsewhere.teamId.value}/insights/alerts/${alert?.id}`)
      .set(TEST_USER_HEADER, elsewhere.owner.value);

    expect(answer.status).toBe(404);
  });

  it('deletes the alerts of a deleted task through the station’s alert state, so a check read before the deletion cannot write them back', async () => {
    const alertStates = app.get(DrizzleStationAlertStateRepository);
    const [alert] = await alertsAtStation();
    const stale = await alertStates.ofAlert(AlertId.of(alert?.id as string));
    const [before] = await db
      .select()
      .from(schema.stationAlertState)
      .where(eq(schema.stationAlertState.stationId, team.stationId.value));

    const deleted: TaskDeletedIntegrationEvent = {
      kind: TASK_DELETED,
      taskId: team.list.id.value,
      workspaceId: team.workspaceId.value,
    };
    await app.get(EventOutbox).record([deleted as never]);

    await eventuallyFound(async () =>
      (await alertsAtStation()).length === 0 ? true : null,
    );
    const [after] = await db
      .select()
      .from(schema.stationAlertState)
      .where(eq(schema.stationAlertState.stationId, team.stationId.value));

    expect(after?.version).toBeGreaterThan(before?.version ?? 0);
    await expect(
      alertStates.save(
        stale?.check([], new Date(), () => AlertId.of(randomUUID())) as never,
      ),
    ).rejects.toBeInstanceOf(StationAlertStateVersionConflictError);
    expect(await alertsAtStation()).toEqual([]);
  });
});
