import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';

describe('setting up the team a workspace starts with (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let owner: string;

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
    owner = randomUUID();
    await db
      .insert(schema.user)
      .values({ id: owner, name: 'Ada', email: `${owner}@example.com` });
  });

  afterAll(async () => {
    await app.close();
  });

  const read = (path: string) =>
    served(app).get(`/api/${path}`).set(TEST_USER_HEADER, owner);

  it('reads as done only once the workspace has its team, and the team its lines and its setup task', async () => {
    const slug = `acme-${randomUUID().slice(0, 8)}`;
    const created = await served(app)
      .post('/api/workspaces')
      .set(TEST_USER_HEADER, owner)
      .send({
        name: 'Acme',
        slug,
        teamName: 'Core',
        survey: { jobFunction: 'engineering' },
      })
      .expect(201);
    const teamId = created.body.teams[0].id as string;

    const workspace = await eventually(async () => {
      const { body } = await read(`workspaces/${slug}`).expect(200);

      return body.setupStatus === 'done' && body;
    });

    expect(workspace.teams.map((each: { id: string }) => each.id)).toEqual([
      teamId,
    ]);

    await eventually(async () => {
      const { body } = await read(
        `teams/${teamId}/configuration/onboarding`,
      ).expect(200);

      return body.provisioning === 'done';
    });

    const lines = await db
      .select({ key: schema.line.key })
      .from(schema.line)
      .where(eq(schema.line.teamId, teamId));
    const setup = await db
      .select({ id: schema.task.id })
      .from(schema.task)
      .innerJoin(schema.taskNote, eq(schema.taskNote.taskId, schema.task.id))
      .where(
        and(
          eq(schema.task.workspaceId, created.body.id),
          eq(schema.taskNote.form, 'setup'),
        ),
      );

    expect(lines.map((each) => each.key)).toEqual(['delivery', 'review']);
    expect(setup).toHaveLength(1);
  });
});
