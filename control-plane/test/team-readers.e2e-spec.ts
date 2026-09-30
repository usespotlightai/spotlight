import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { openTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
const ADMIN = randomUUID();
const ELSEWHERE_IN_WORKSPACE = randomUUID();

const outcomes = () =>
  `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/outcomes`;

const as = (userId: string, path: string) =>
  served(app).get(path).set(TEST_USER_HEADER, userId);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `readers-${randomUUID().slice(0, 8)}`,
  );
  const workspaceId = team.workspaceId.value;
  const otherTeam = randomUUID();

  await db.insert(schema.user).values([
    { id: ADMIN, name: 'Cy', email: `${ADMIN}@example.com` },
    {
      id: ELSEWHERE_IN_WORKSPACE,
      name: 'Bea',
      email: `${ELSEWHERE_IN_WORKSPACE}@example.com`,
    },
  ]);
  await db.insert(schema.workspaceMember).values([
    { workspaceId, userId: ADMIN, role: 'admin' },
    { workspaceId, userId: ELSEWHERE_IN_WORKSPACE, role: 'member' },
  ]);
  await db.insert(schema.team).values({
    id: otherTeam,
    workspaceId,
    key: `payments-${otherTeam.slice(0, 8)}`,
    name: 'Payments',
  });
  await db
    .insert(schema.teamMember)
    .values({ teamId: otherTeam, userId: ELSEWHERE_IN_WORKSPACE });
});

afterAll(async () => {
  await app?.close();
});

describe('who may read a team’s station outcomes', () => {
  it('answers a member of the team', async () => {
    expect((await as(team.owner.value, outcomes())).status).toBe(200);
  });

  it('answers an admin of the workspace who is not on the team', async () => {
    expect((await as(ADMIN, outcomes())).status).toBe(200);
  });

  it('finds no team for a workspace member who is only on another team', async () => {
    expect((await as(ELSEWHERE_IN_WORKSPACE, outcomes())).status).toBe(404);
  });
});
