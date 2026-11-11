import { randomUUID } from 'node:crypto';

import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type Answer, openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOUR = 60 * 60_000;

const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const remembered = async (
  change: Partial<typeof schema.memory.$inferInsert>,
) => {
  const id = randomUUID();

  await db.insert(schema.memory).values({
    id,
    handle: sql`nextval('memory_handle_seq')`,
    workspaceId: team.workspaceId.value,
    kind: 'rationale',
    body: `Memory ${id.slice(0, 4)}`,
    teamId: team.teamId.value,
    paths: [],
    source: 'person',
    approvedById: team.owner.value,
    approvedAt: ago(48),
    ...change,
  });

  return id;
};

const ran = async (runId: string) => {
  const ended = RunRecord.empty(RunId.of(runId), team.workspaceId).recordEnd(
    RunEnd.of({
      location: RunLocation.of({
        teamId: team.teamId,
        lineId: LineId.of(team.line.id.value),
        stationId: StationId.of(team.stationId.value),
        taskId: team.list.id,
      }),
      fingerprint: null,
      agentConfig: RunAgentConfig.of({
        harness: 'claude-code',
        model: null,
        effort: null,
        profileKey: null,
        repositories: [],
        skills: [],
      }),
      queuedAt: ago(3),
      startedAt: null,
      endedAt: ago(2),
      ending: 'completed',
      failure: null,
      visit: 1,
      asked: false,
    }),
  );

  await app
    .get(DrizzleRunRecordRepository)
    .add(
      runId.endsWith('x')
        ? ended.recordAction(HumanAction.of('accepted', ago(1)))
        : ended,
    );
};

const used = (runId: string, via: MemoryUse, memory: string) =>
  app.get(RecordMemoryUses).recorded(
    {
      id: RunId.of(runId),
      workspaceId: team.workspaceId,
      taskId: team.list.id,
    },
    via,
    [MemoryId.of(memory)],
  );

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `memory-${randomUUID().slice(0, 8)}`,
  );

  const active = await remembered({});
  const wrong = await remembered({
    status: 'retired',
    retiredAt: ago(5),
    retiredById: team.owner.value,
    retireReason: 'We stopped doing this',
  });
  await remembered({
    status: 'retired',
    retiredAt: ago(5),
    supersededBy: active,
  });

  const [x, y, z] = [
    `${randomUUID()}x`,
    `${randomUUID()}y`,
    `${randomUUID()}z`,
  ];
  for (const runId of [x, y, z]) {
    await ran(runId);
  }
  await used(x, 'briefed', active);
  await used(x, 'recalled', active);
  await used(y, 'briefed', wrong);
  await app.get(RecordMemoryUses).recorded(
    {
      id: RunId.of(`${randomUUID()}-elsewhere`),
      workspaceId: team.workspaceId,
      taskId: TaskId.of(randomUUID()),
    },
    'recalled',
    [MemoryId.of(wrong)],
  );
  await eventually(async () => {
    await app.get(EventDelivery).drain(2_000);
    const facts = await db
      .select({ memories: schema.runFact.memories })
      .from(schema.runFact)
      .where(inArray(schema.runFact.runId, [x, y]));

    return (
      facts.filter((each) => each.memories.briefed.length > 0).length === 2 &&
      facts.some((each) => each.memories.recalled.length > 0)
    );
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('the team’s memory on Insights (e2e)', () => {
  it('counts active memories, their use by the period’s runs only, the ones flagged wrong, and runs with memories against runs without', async () => {
    const answer = (await served(app)
      .get(`/api/teams/${team.teamId.value}/insights/memory?period=7d`)
      .set(TEST_USER_HEADER, team.owner.value)) as Answer<{
      readonly flagged: unknown;
      readonly withMemories: unknown;
      readonly withoutMemories: unknown;
    }>;

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      activeCount: 1,
      memoriesBriefed: 2,
      memoriesRecalled: 1,
      runsBriefed: 2,
      runsRecalled: 1,
    });
    expect(answer.body.flagged).toEqual([
      expect.objectContaining({
        reason: 'We stopped doing this',
        by: team.owner.value,
        byName: 'Ada',
      }),
    ]);
    expect(answer.body.withMemories).toMatchObject({ runs: 2, accepted: 1 });
    expect(answer.body.withoutMemories).toMatchObject({ runs: 1, accepted: 0 });
  });
});
