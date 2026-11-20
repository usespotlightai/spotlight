import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

interface TaskBody {
  readonly id: string;
  readonly runNotStarted: { readonly harness: string } | null;
}

const LINE = randomUUID();
const BACKLOG = randomUUID();
const BUILD = randomUUID();

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const asOwner = <T extends { set: (key: string, value: string) => T }>(
  request: T,
) => request.set(TEST_USER_HEADER, team.owner.value);

const teamPath = (path: string) => `/api/teams/${team.teamId.value}${path}`;

const added = async (stationId: string): Promise<TaskBody> =>
  (
    await asOwner(
      served(app).post(teamPath(`/lines/${LINE}/stations/${stationId}/tasks`)),
    )
      .send({ title: 'Drain the queue' })
      .expect(201)
  ).body as TaskBody;

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `not-started-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: LINE,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await insertStations(db, [
    {
      id: BACKLOG,
      workspaceId: team.workspaceId.value,
      lineId: LINE,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      workspaceId: team.workspaceId.value,
      lineId: LINE,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'not-a-harness',
      finishes: true,
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: LINE,
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

describe('a task whose agent does not start', () => {
  it('says which agent did not start, keeps a message and tries again', async () => {
    const task = await added(BUILD);

    expect(task.runNotStarted).toEqual({ harness: 'not-a-harness' });

    const messaged = await asOwner(
      served(app).post(teamPath(`/tasks/${task.id}/messages`)),
    )
      .send({ body: 'Use the new image.' })
      .expect(200);
    expect((messaged.body as TaskBody).runNotStarted).toEqual({
      harness: 'not-a-harness',
    });

    const stored = await db
      .select({ body: schema.taskNote.body })
      .from(schema.taskNote)
      .where(eq(schema.taskNote.taskId, task.id));
    expect(stored.map((note) => note.body)).toContain('Use the new image.');

    const retried = await asOwner(
      served(app).post(teamPath(`/tasks/${task.id}/start`)),
    ).expect(200);
    expect((retried.body as TaskBody).runNotStarted).toEqual({
      harness: 'not-a-harness',
    });
  });

  it('refuses Try again for a task that waits for nothing', async () => {
    const task = await added(BACKLOG);

    expect(task.runNotStarted).toBeNull();
    await asOwner(served(app).post(teamPath(`/tasks/${task.id}/start`))).expect(
      409,
    );
  });
});
