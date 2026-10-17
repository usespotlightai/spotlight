import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
const ADMIN = randomUUID();
const ELSEWHERE_IN_WORKSPACE = randomUUID();
const RUN = randomUUID();

const outcomes = () =>
  `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/outcomes`;

const judge = () =>
  `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/judge`;

const as = (userId: string, path: string) =>
  served(app).get(path).set(TEST_USER_HEADER, userId);

const scores = () => `/api/teams/${team.teamId.value}/runs/${RUN}/scores`;

const grades = () => `/api/teams/${team.teamId.value}/runs/${RUN}/grades`;

const inbox = () => `/api/workspaces/${team.slug}/inbox`;

const asidesIn = async (userId: string): Promise<string[]> => {
  const answer = await as(userId, inbox());

  expect(answer.status).toBe(200);

  return (answer.body as { id: string; aside: unknown }[]).flatMap((each) =>
    each.aside ? [each.id] : [],
  );
};

const raiseAside = async (
  form: (typeof schema.taskAside.$inferInsert)['form'],
  assigneeId: string | null,
): Promise<string> => {
  const taskId = randomUUID();
  const asideId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: team.stationId.value,
    title: `A ${form} aside`,
    assigneeId,
  });
  await db.insert(schema.taskAside).values({
    id: asideId,
    workspaceId: team.workspaceId.value,
    taskId,
    form,
    about: RUN,
    raisedAt: new Date(),
  });

  return asideId;
};

const readAside = (userId: string, asideId: string) =>
  served(app)
    .post(`${inbox()}/asides/${asideId}/read`)
    .set(TEST_USER_HEADER, userId);

const overview = () =>
  `/api/teams/${team.teamId.value}/insights/overview?period=7d`;

const readToken = async (of = team): Promise<string> => {
  const answer = await served(app)
    .post(`/api/resources/workspaces/${of.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, of.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `readers-${randomUUID().slice(0, 6)}`, scopes: ['read'] });

  expect(answer.status).toBe(201);

  return answer.headers['spotlight-workspace-token'] as string;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
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
  await db.insert(schema.runRecord).values({
    runId: RUN,
    workspaceId,
    teamId: team.teamId.value,
    lineId: team.line.id.value,
    stationId: team.stationId.value,
    taskId: team.list.id.value,
    fingerprint: 'a'.repeat(64),
    harness: 'claude-code',
    repositories: [],
    skills: [],
    endedAt: new Date(),
    ending: 'completed',
    round: 1,
  });
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

describe('who may read how a station’s judge agrees with people', () => {
  it('answers a member of the team', async () => {
    expect((await as(team.owner.value, judge())).status).toBe(200);
  });

  it('answers an admin of the workspace who is not on the team', async () => {
    expect((await as(ADMIN, judge())).status).toBe(200);
  });

  it('finds no team for a workspace member who is only on another team', async () => {
    expect((await as(ELSEWHERE_IN_WORKSPACE, judge())).status).toBe(404);
  });
});

describe('who may grade a team’s runs and read their scores', () => {
  it('answers a member of the team', async () => {
    expect((await as(team.owner.value, scores())).status).toBe(200);
  });

  it('answers an admin of the workspace who is not on the team', async () => {
    expect((await as(ADMIN, scores())).status).toBe(200);
  });

  it('finds no team for a workspace member who is only on another team', async () => {
    expect((await as(ELSEWHERE_IN_WORKSPACE, scores())).status).toBe(404);
    expect(
      (
        await served(app)
          .post(grades())
          .set(TEST_USER_HEADER, ELSEWHERE_IN_WORKSPACE)
          .send({ value: true })
      ).status,
    ).toBe(404);
  });
});

describe('who is told which memories a run used', () => {
  let memoriesAside: string;

  beforeAll(async () => {
    memoriesAside = await raiseAside('memories', null);
  });

  it('tells a workspace member who is only on another team while nobody is assigned', async () => {
    expect(await asidesIn(ELSEWHERE_IN_WORKSPACE)).toContain(memoriesAside);
    expect(
      (await readAside(ELSEWHERE_IN_WORKSPACE, memoriesAside)).status,
    ).toBe(204);
  });
});

describe('who is told which memories a run used on a deleted team’s line', () => {
  let memoriesAside: string;

  beforeAll(async () => {
    const teamId = randomUUID();
    const lineId = randomUUID();
    const stationId = randomUUID();
    const taskId = randomUUID();
    memoriesAside = randomUUID();

    await db.insert(schema.team).values({
      id: teamId,
      workspaceId: team.workspaceId.value,
      key: `gone-${teamId.slice(0, 8)}`,
      name: 'Gone',
    });
    await db.insert(schema.line).values({
      id: lineId,
      workspaceId: team.workspaceId.value,
      teamId,
      key: 'default',
      name: 'Default',
    });
    await db.insert(schema.station).values([
      {
        id: stationId,
        lineId,
        key: 'backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      },
      {
        id: randomUUID(),
        lineId,
        key: 'completed',
        name: 'Completed',
        position: 1,
        kind: 'completed',
      },
    ]);
    await db.insert(schema.task).values({
      id: taskId,
      openedFrom: 'person',
      workspaceId: team.workspaceId.value,
      stationId,
      title: 'A memories aside on a deleted team’s line',
    });
    await db.insert(schema.taskAside).values({
      id: memoriesAside,
      workspaceId: team.workspaceId.value,
      taskId,
      form: 'memories',
      about: RUN,
      raisedAt: new Date(),
    });
    await db.delete(schema.team).where(eq(schema.team.id, teamId));
  });

  it('neither lists nor reads it for a workspace member while nobody is assigned', async () => {
    expect(await asidesIn(ELSEWHERE_IN_WORKSPACE)).not.toContain(memoriesAside);
    expect(
      (await readAside(ELSEWHERE_IN_WORKSPACE, memoriesAside)).status,
    ).toBe(404);
  });
});

describe('who is asked to grade a team’s run in their inbox', () => {
  let unassigned: string;
  let assignedElsewhere: string;

  beforeAll(async () => {
    unassigned = await raiseAside('grade', null);
    assignedElsewhere = await raiseAside('grade', ELSEWHERE_IN_WORKSPACE);
  });

  it('asks a member of the team, whoever the task is assigned to', async () => {
    expect(await asidesIn(team.owner.value)).toEqual(
      expect.arrayContaining([unassigned, assignedElsewhere]),
    );
  });

  it('asks an admin of the workspace who is not on the team, whoever the task is assigned to', async () => {
    expect(await asidesIn(ADMIN)).toEqual(
      expect.arrayContaining([unassigned, assignedElsewhere]),
    );
  });

  it('asks no workspace member who is only on another team, nor lets them read it, even when the task is theirs', async () => {
    const asides = await asidesIn(ELSEWHERE_IN_WORKSPACE);

    expect(asides).not.toContain(unassigned);
    expect(asides).not.toContain(assignedElsewhere);
    expect((await readAside(ELSEWHERE_IN_WORKSPACE, unassigned)).status).toBe(
      404,
    );
    expect(
      (await readAside(ELSEWHERE_IN_WORKSPACE, assignedElsewhere)).status,
    ).toBe(404);
  });
});

describe('who may read a team’s Insights', () => {
  it('answers a member of the team', async () => {
    expect((await as(team.owner.value, overview())).status).toBe(200);
  });

  it('answers an admin of the workspace who is not on the team', async () => {
    expect((await as(ADMIN, overview())).status).toBe(200);
  });

  it('finds no team for a workspace member who is only on another team', async () => {
    expect((await as(ELSEWHERE_IN_WORKSPACE, overview())).status).toBe(404);
  });

  it('answers a workspace token with the read scope', async () => {
    const token = await readToken();

    expect(
      (
        await served(app)
          .get(overview())
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(200);
  });

  it('finds no team for a workspace token from another workspace', async () => {
    const token = await readToken(
      await createTeam(
        db,
        app.get(DrizzleTaskRepository),
        `elsewhere-${randomUUID().slice(0, 8)}`,
      ),
    );

    expect(
      (
        await served(app)
          .get(overview())
          .set('Authorization', `Bearer ${token}`)
      ).status,
    ).toBe(404);
  });
});

describe('who is alerted about a team’s station in their inbox', () => {
  let alertAside: string;

  beforeAll(async () => {
    alertAside = await raiseAside('alert', null);
  });

  it('alerts a member of the team', async () => {
    expect(await asidesIn(team.owner.value)).toContain(alertAside);
  });

  it('alerts an admin of the workspace who is not on the team', async () => {
    expect(await asidesIn(ADMIN)).toContain(alertAside);
  });

  it('alerts no workspace member who is only on another team, nor lets them read it', async () => {
    expect(await asidesIn(ELSEWHERE_IN_WORKSPACE)).not.toContain(alertAside);
    expect((await readAside(ELSEWHERE_IN_WORKSPACE, alertAside)).status).toBe(
      404,
    );
  });
});
