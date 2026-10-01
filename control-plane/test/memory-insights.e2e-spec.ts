import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOUR = 60 * 60_000;

const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

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
    approvedBy: team.owner.value,
    approvedAt: ago(48),
    ...change,
  });

  return id;
};

const ran = async (runId: string) => {
  await db.insert(schema.runRecord).values({
    runId,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    lineId: team.line.id.value,
    stationId: team.stationId.value,
    taskId: team.list.id.value,
    harness: 'claude-code',
    repositories: [],
    skills: [],
    queuedAt: ago(3),
    endedAt: ago(2),
    ending: 'completed',
    round: 1,
    nextAct: runId.endsWith('x') ? 'approved' : null,
    nextAt: runId.endsWith('x') ? ago(1) : null,
  });
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `memory-${randomUUID().slice(0, 8)}`,
  );

  const standing = await remembered({});
  const wrong = await remembered({
    standing: 'retired',
    retiredAt: ago(5),
    retiredBy: team.owner.value,
    retireReason: 'We stopped doing this',
  });
  await remembered({
    standing: 'retired',
    retiredAt: ago(5),
    supersededBy: standing,
  });

  const [x, y, z] = [
    `${randomUUID()}x`,
    `${randomUUID()}y`,
    `${randomUUID()}z`,
  ];
  for (const runId of [x, y, z]) {
    await ran(runId);
  }
  await db.insert(schema.memoryUse).values([
    { memoryId: standing, runId: x, way: 'briefed', at: ago(2) },
    { memoryId: standing, runId: x, way: 'recalled', at: ago(2) },
    { memoryId: wrong, runId: y, way: 'briefed', at: ago(2) },
    {
      memoryId: wrong,
      runId: `${randomUUID()}-elsewhere`,
      way: 'recalled',
      at: ago(2),
    },
  ]);
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('the team’s memory on Insights (e2e)', () => {
  it('counts standing memories, their use by the period’s runs only, the ones flagged wrong, and runs with memories against runs without', async () => {
    const answer = await served(app)
      .get(`/api/teams/${team.teamId.value}/insights/memory?period=7d`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      standing: 1,
      memoriesBriefed: 2,
      memoriesRecalled: 1,
      runsBriefed: 2,
      runsRecalled: 1,
      benchmark: null,
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
