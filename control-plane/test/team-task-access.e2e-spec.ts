import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
const TEAMMATE = randomUUID();
const ADMIN = randomUUID();
const BYSTANDER = randomUUID();
const OUTSIDER = randomUUID();

const tasksOfTeam = () => `/api/teams/${team.teamId.value}/tasks`;

const taskAt = async (): Promise<string> => {
  const id = randomUUID();

  await db.insert(schema.task).values({
    id,
    branch: `feat/test-${id}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: team.stationId.value,
    title: 'Drain the queue',
    originStationId: team.stationId.value,
    createdById: team.owner.value,
  });

  return id;
};

const completedStation = (): string => {
  const completed = team.line.stations.find((each) => each.isCompleted);

  if (!completed) {
    throw new Error('the line has no completed station');
  }

  return completed.id.value;
};

const adding = (by: string) =>
  served(app)
    .post(
      `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/tasks`,
    )
    .set(TEST_USER_HEADER, by)
    .send({ title: 'Rotate the keys' });

const assigning = (by: string, taskId: string) =>
  served(app)
    .put(`${tasksOfTeam()}/${taskId}/assignee`)
    .set(TEST_USER_HEADER, by)
    .send({ assigneeId: team.owner.value });

const moving = (by: string, taskId: string) =>
  served(app)
    .post(
      `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/tasks/${taskId}/move`,
    )
    .set(TEST_USER_HEADER, by)
    .send({ stationId: completedStation(), revision: 0 });

const deleting = (by: string, taskId: string) =>
  served(app).delete(`${tasksOfTeam()}/${taskId}`).set(TEST_USER_HEADER, by);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `access-${randomUUID().slice(0, 8)}`,
  );
  const workspaceId = team.workspaceId.value;

  await db.insert(schema.user).values(
    [TEAMMATE, ADMIN, BYSTANDER, OUTSIDER].map((id, at) => ({
      id,
      name: ['Bea', 'Cy', 'Dee', 'Eve'][at] as string,
      email: `${id}@example.com`,
    })),
  );
  await db.insert(schema.workspaceMember).values([
    { workspaceId, userId: TEAMMATE, role: 'member' },
    { workspaceId, userId: ADMIN, role: 'admin' },
    { workspaceId, userId: BYSTANDER, role: 'member' },
  ]);
  await db.insert(schema.teamMember).values({
    workspaceId,
    teamId: team.teamId.value,
    userId: TEAMMATE,
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a workspace member who is not on the team', () => {
  it('lists the team’s tasks', async () => {
    const taskId = await taskAt();
    const answer = await served(app)
      .get(tasksOfTeam())
      .set(TEST_USER_HEADER, BYSTANDER);

    expect(answer.status).toBe(200);
    expect(
      (answer.body.items as { id: string }[]).map((each) => each.id),
    ).toContain(taskId);
  });

  it('reads one of the team’s tasks', async () => {
    const taskId = await taskAt();
    const answer = await served(app)
      .get(`${tasksOfTeam()}/${taskId}`)
      .set(TEST_USER_HEADER, BYSTANDER);

    expect(answer.status).toBe(200);
    expect(answer.body.id).toBe(taskId);
  });

  it('may not add a task, and is told why', async () => {
    const answer = await adding(BYSTANDER);

    expect(answer.status).toBe(403);
    expect(answer.body.message).toContain('not a member of this team');
  });

  it('may not assign a task', async () => {
    const taskId = await taskAt();

    expect((await assigning(BYSTANDER, taskId)).status).toBe(403);
    expect(
      (
        await served(app)
          .get(`${tasksOfTeam()}/${taskId}`)
          .set(TEST_USER_HEADER, BYSTANDER)
      ).body.assignee,
    ).toBeNull();
  });

  it('may not move a task', async () => {
    const taskId = await taskAt();

    expect((await moving(BYSTANDER, taskId)).status).toBe(403);
    expect(
      (
        await served(app)
          .get(`${tasksOfTeam()}/${taskId}`)
          .set(TEST_USER_HEADER, BYSTANDER)
      ).body.stationId,
    ).toBe(team.stationId.value);
  });

  it('may not delete a task', async () => {
    const taskId = await taskAt();

    expect((await deleting(BYSTANDER, taskId)).status).toBe(403);
    expect(
      (
        await served(app)
          .get(`${tasksOfTeam()}/${taskId}`)
          .set(TEST_USER_HEADER, BYSTANDER)
      ).status,
    ).toBe(200);
  });
});

describe('someone outside the workspace', () => {
  it('finds no task to assign', async () => {
    expect((await assigning(OUTSIDER, await taskAt())).status).toBe(404);
  });

  it('finds no line to add a task to', async () => {
    expect((await adding(OUTSIDER)).status).toBe(404);
  });
});

describe('a member of the team', () => {
  it('adds, assigns, moves and deletes the team’s tasks', async () => {
    const added = await adding(TEAMMATE);

    expect(added.status).toBe(201);
    expect((await assigning(TEAMMATE, added.body.id)).status).toBe(200);
    expect((await moving(TEAMMATE, added.body.id)).status).toBe(200);
    expect((await deleting(TEAMMATE, added.body.id)).status).toBe(204);
  });
});

describe('a workspace admin who is not on the team', () => {
  it('adds, assigns, moves and deletes the team’s tasks', async () => {
    const added = await adding(ADMIN);

    expect(added.status).toBe(201);
    expect((await assigning(ADMIN, added.body.id)).status).toBe(200);
    expect((await moving(ADMIN, added.body.id)).status).toBe(200);
    expect((await deleting(ADMIN, added.body.id)).status).toBe(204);
  });
});
