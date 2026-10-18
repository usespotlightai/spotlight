import { randomUUID } from 'node:crypto';
import {
  RUN_ACCEPTANCE,
  type RunAcceptancePort,
} from '@insights/application/ports/run-acceptance.port';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import type { HumanActionKind } from '@work/domain/value-objects/human-action-kind';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const MINUTE = 60_000;
const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * MINUTE);

const TOOL = CalledTool.of({ server: 'linear', tool: 'create_issue' });

type Acted = readonly [HumanActionKind, number];

const RUNS = {
  approvedThenClosed: [
    ['approved', 100],
    ['accepted', 90],
  ],
  approvedThenSentBack: [
    ['approved', 100],
    ['sent-back', 90],
  ],
  onlyApproved: [['approved', 100]],
  closedReceivedBeforeTheRefusalBeforeIt: [
    ['accepted', 90],
    ['refused', 100],
  ],
  sentBackReceivedAfterTheCloseAfterIt: [
    ['accepted', 80],
    ['sent-back', 85],
  ],
} satisfies Record<string, readonly Acted[]>;

type RunName = keyof typeof RUNS;

let app: INestApplication;
let team: Awaited<ReturnType<typeof createTeam>>;
const runIds = new Map<RunName, RunId>();

const runOf = (name: RunName): RunId => {
  const runId = runIds.get(name);

  if (!runId) {
    throw new Error(`no run ${name}`);
  }

  return runId;
};

const insights = (tab: string, query = 'period=7d') =>
  served(app)
    .get(`/api/teams/${team.teamId.value}/insights/${tab}?${query}`)
    .set(TEST_USER_HEADER, team.owner.value);

beforeAll(async () => {
  app = await openApp();
  const db: DrizzleDatabase = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `approvals-${randomUUID().slice(0, 8)}`,
  );
  const records = app.get(DrizzleRunRecordRepository);

  const delivered = async (
    events: readonly unknown[],
    check: () => Promise<unknown>,
  ) => {
    await app.get(EventOutbox).record(events as DomainEvent[]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      return check();
    }, 60_000);
  };

  for (const [name, acts] of Object.entries(RUNS) as [
    RunName,
    readonly Acted[],
  ][]) {
    const runId = RunId.of(randomUUID());
    const taskId = TaskId.of(randomUUID());
    runIds.set(name, runId);

    await db.insert(schema.run).values({
      id: runId.value,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      taskId: taskId.value,
      taskRevision: 0,
      stationId: team.stationId.value,
      state: 'completed',
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        continuity: { key: 'task:station' },
      },
      createdAt: ago(130),
      startedAt: ago(125),
      endedAt: ago(120),
    });

    const ended: RunEndedIntegrationEvent = {
      kind: RUN_ENDED,
      runId: runId.value,
      workspaceId: team.workspaceId.value,
      taskId: taskId.value,
      stationId: team.stationId.value,
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
    };
    await delivered([ended], async () => (await records.of(runId))?.hasEnded);

    for (const [act, minutesAgo] of acts) {
      const before = await records.of(runId);

      await delivered(
        [
          new TaskActedOn(
            taskId,
            team.workspaceId,
            team.stationId,
            act,
            team.owner,
            runId,
            ago(minutesAgo),
            act === 'approved' || act === 'refused' ? TOOL : null,
          ),
        ],
        async () => (await records.of(runId))?.version !== before?.version,
      );
    }
  }
}, 180_000);

afterAll(async () => {
  await app?.close();
});

describe('a run a person decided a tool approval for (e2e)', () => {
  it('is accepted or sent back by what the person did next, never by the approval', async () => {
    const acceptance = app.get<RunAcceptancePort>(RUN_ACCEPTANCE);
    const accepted = async (name: RunName) =>
      acceptance.acceptedAfter(runOf(name).value);

    expect(await accepted('approvedThenClosed')).toBe(true);
    expect(await accepted('closedReceivedBeforeTheRefusalBeforeIt')).toBe(true);
    expect(await accepted('approvedThenSentBack')).toBe(false);
    expect(await accepted('onlyApproved')).toBe(false);
    expect(await accepted('sentBackReceivedAfterTheCloseAfterIt')).toBe(false);
  });

  it('gives each run its disposition when the person only decided the approval', async () => {
    const dispositions = await app
      .get<RunAcceptancePort>(RUN_ACCEPTANCE)
      .dispositions([...runIds.values()].map((each) => each.value));

    expect(
      Object.fromEntries(
        [...runIds].map(([name, runId]) => [
          name,
          dispositions.get(runId.value),
        ]),
      ),
    ).toEqual({
      approvedThenClosed: 'accepted',
      approvedThenSentBack: 'sent-back',
      onlyApproved: 'asked',
      closedReceivedBeforeTheRefusalBeforeIt: 'accepted',
      sentBackReceivedAfterTheCloseAfterIt: 'sent-back',
    });
  });

  it('counts on Insights only what people did next as accepting or sending back', async () => {
    const stations = await insights('stations');
    const people = await insights('people');

    expect(stations.status).toBe(200);
    expect(stations.body.stations[0].tally).toMatchObject({
      runs: 5,
      accepted: 2,
      sentBack: 2,
    });
    expect(people.status).toBe(200);
    expect(people.body.load).toMatchObject({
      sentBack: 2,
      sentBackRate: 0.4,
      refused: 1,
    });
  });

  it('drills down to the runs by what people did next, never by an approval', async () => {
    const total = async (humanAction: string) =>
      (await insights('runs', `period=7d&humanAction=${humanAction}`)).body
        .total;

    expect(await total('accepted')).toBe(2);
    expect(await total('sent-back')).toBe(2);
    expect(
      (await insights('runs', 'period=7d&humanAction=approved')).status,
    ).toBe(422);
  });
});
