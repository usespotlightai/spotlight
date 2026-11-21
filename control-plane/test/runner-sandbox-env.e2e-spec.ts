import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { deleteRunnersOf } from './support/runners';
import { requestedByChat } from './support/runs';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-env-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'p'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const KEY = '-----BEGIN KEY-----\nabc\n-----END KEY-----';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

interface LeasedRun {
  readonly runId: string;
  readonly token: string;
}

const secret = (name: string, sandbox: string) =>
  http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/secrets`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name, sandbox, valueWo: KEY, valueWoVersion: 1 })
    .expect(201);

const claimed = async (runId: string): Promise<string> => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      bootId: 'boot_1',
      name: 'build-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [{ id: 'dev', models: [] }],
        },
      ],
    })
    .expect(200);

  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(assignment.work.run.id).toBe(runId);

  return assignment.token;
};

const aLeasedRun = async (
  sandboxEnv: readonly { variable: string; secret: string }[],
): Promise<LeasedRun> => {
  const chatId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    startedById: team.owner.value,
    title: 'Planning',
    harness: 'dev',
  });
  await db.insert(schema.run).values({
    ...requestedByChat(chatId, { teamId: team.teamId.value }),
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Run the app.',
      handover: { options: ['review'], noteLimit: 0 },
      resume: {},
      sandboxEnv,
    },
  });

  return { runId, token: await claimed(runId) };
};

const revealed = (leased: LeasedRun, attempt: number) =>
  http()
    .post(`/api/runs/${leased.runId}/sandbox-env`)
    .set('Authorization', `Bearer ${leased.token}`)
    .send({ attempt });

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `env-${randomUUID().slice(0, 8)}`,
  );

  await http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);

  await secret('DEV_GITHUB_APP_KEY', 'env');
  await secret('LINEAR_API_KEY', 'stand-in');
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a runner getting the secrets its run puts in the sandbox', () => {
  it('gets the value of each secret that allows it, and why it cannot have the others', async () => {
    const leased = await aLeasedRun([
      { variable: 'GITHUB_APP_PRIVATE_KEY', secret: 'DEV_GITHUB_APP_KEY' },
      { variable: 'LINEAR_API_KEY', secret: 'LINEAR_API_KEY' },
    ]);

    const answer = await revealed(leased, 1).expect(200);

    expect(answer.body).toEqual({
      variables: [{ name: 'GITHUB_APP_PRIVATE_KEY', value: KEY }],
      denied: [
        {
          secret: 'LINEAR_API_KEY',
          reason:
            'Secret LINEAR_API_KEY does not allow its value in a sandbox. Set sandbox = "env" on the secret.',
        },
      ],
    });
  });

  it('gets nothing for an attempt the run is no longer on', async () => {
    const leased = await aLeasedRun([
      { variable: 'GITHUB_APP_PRIVATE_KEY', secret: 'DEV_GITHUB_APP_KEY' },
    ]);

    await revealed(leased, 2).expect(409);
  });
});
