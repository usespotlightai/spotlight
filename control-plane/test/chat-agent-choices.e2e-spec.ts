import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { openTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

const post = (path: string, body: object) =>
  served(app)
    .post(`/api/teams/${team.teamId.value}/chats${path}`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send(body);

const started = async (): Promise<string> =>
  (
    await post('', {
      harness: 'claude-code',
      body: 'Plan the retries.',
    }).expect(201)
  ).body.id as string;

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `chat-choices-${randomUUID().slice(0, 8)}`,
  );
});

afterAll(async () => {
  await app?.close();
});

describe('choosing the agent’s model and effort in a chat', () => {
  it('refuses to start on a model that is empty or not text', async () => {
    await post('', {
      harness: 'claude-code',
      model: '',
      body: 'Plan the retries.',
    }).expect(422);
    await post('', {
      harness: 'claude-code',
      model: 5,
      body: 'Plan the retries.',
    }).expect(400);
  });

  it('answers with the model and effort a message picks, and refuses an empty or unknown one', async () => {
    const chatId = await started();

    await post(`/${chatId}/messages`, { body: 'Again.', model: '' }).expect(
      422,
    );
    await post(`/${chatId}/messages`, {
      body: 'Again.',
      effort: 'enormous',
    }).expect(422);
    await post(`/${chatId}/messages`, { body: 'Again.', effort: 3 }).expect(
      400,
    );
    await post(`/${chatId}/messages`, {
      body: 'Think harder.',
      model: 'opus',
      effort: 'high',
    }).expect(204);

    const read = (
      await served(app)
        .get(`/api/teams/${team.teamId.value}/chats/${chatId}`)
        .set(TEST_USER_HEADER, team.owner.value)
        .expect(200)
    ).body as { model: string | null; effort: string | null };

    expect(read).toMatchObject({ model: 'opus', effort: 'high' });
  });
});
