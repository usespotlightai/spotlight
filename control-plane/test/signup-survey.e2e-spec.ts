import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';

describe('the survey a workspace is created with (e2e)', () => {
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

  const create = (survey: unknown) =>
    served(app)
      .post('/api/workspaces')
      .set(TEST_USER_HEADER, owner)
      .send({
        name: 'Acme',
        slug: `acme-${randomUUID().slice(0, 8)}`,
        teamName: 'Core',
        survey,
      });

  const surveyOf = (workspaceId: string) =>
    db
      .select()
      .from(schema.signupSurvey)
      .where(eq(schema.signupSurvey.workspaceId, workspaceId));

  it('records the answers of the person who created the workspace', async () => {
    const created = await create({
      jobFunction: 'founder',
      referralSource: '  Hacker News  ',
    }).expect(201);

    expect(await surveyOf(created.body.id)).toEqual([
      expect.objectContaining({
        respondentId: owner,
        jobFunction: 'founder',
        referralSource: 'Hacker News',
      }),
    ]);
  });

  it('records no referral source when it is left out', async () => {
    const created = await create({ jobFunction: 'engineering' }).expect(201);

    expect(await surveyOf(created.body.id)).toEqual([
      expect.objectContaining({ referralSource: null }),
    ]);
  });

  it.each([
    ['no survey', undefined],
    ['no job function', { referralSource: 'A colleague' }],
    [
      'a referral source that is not text',
      { jobFunction: 'data', referralSource: 7 },
    ],
  ])('refuses %s as a bad request', async (_reason, survey) => {
    await create(survey).expect(400);
  });

  it('refuses an unknown job function, and creates no workspace', async () => {
    const before = await db.select().from(schema.workspace);

    await create({ jobFunction: 'astronaut' }).expect(422);

    expect(await db.select().from(schema.workspace)).toHaveLength(
      before.length,
    );
  });
});
