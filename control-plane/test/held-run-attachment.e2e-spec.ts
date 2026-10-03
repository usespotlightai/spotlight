import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-attachment-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'a'.repeat(8)}${randomUUID().replaceAll('-', '')}`;

const attachmentStore = {
  received: async () => [],
  open: async () => ({
    bytes: new Uint8Array([7, 7, 7]),
    contentType: 'image/png',
  }),
} as unknown as AttachmentStorePort;

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

const http = () => served(app);

interface Held {
  readonly runId: string;
  readonly attachmentId: string;
  readonly token: string;
}

const aChatRun = async (): Promise<{
  runId: string;
  attachmentId: string;
}> => {
  const chatId = randomUUID();
  const runId = randomUUID();
  const attachmentId = randomUUID();

  await db.insert(schema.chat).values({
    id: chatId,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    startedById: team.owner.value,
    title: 'Planning',
    harness: 'claude-code',
  });
  await db.insert(schema.chatMessage).values({
    chatId,
    position: 0,
    kind: 'said',
    body: 'Here is the screen.',
    at: new Date(),
    authorId: team.owner.value,
  });
  await db.insert(schema.chatAttachment).values({
    id: attachmentId,
    chatId,
    messagePosition: 0,
    place: 0,
    name: 'screen.png',
    contentType: 'image/png',
    size: 3,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'claude-code',
    chatId,
    state: 'queued',
    spec: {
      checkouts: [],
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Plan with me.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: `chat-${chatId}` },
    },
  });

  return { runId, attachmentId };
};

const claimed = async (): Promise<Held> => {
  const queued = await aChatRun();
  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(handed.work.run.id).toBe(queued.runId);

  return { ...queued, token: handed.token };
};

const read = (token: string, runId: string, attachmentId: string) =>
  http()
    .get(`/api/runs/${runId}/attachments/${attachmentId}`)
    .set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  app = await openApp((module) =>
    module.overrideProvider(ATTACHMENT_STORE).useValue(attachmentStore),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `attachment-${randomUUID().slice(0, 8)}`,
  );

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      session: 'session_1',
      name: 'chat-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          usual: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('reading a file given to a held chat run', () => {
  it('hands the runner holding the run a file its chat was given, byte for byte', async () => {
    const held = await claimed();

    const file = await read(held.token, held.runId, held.attachmentId)
      .expect(200)
      .buffer(true);

    expect([...(file.body as Buffer)]).toEqual([7, 7, 7]);
  });

  it('refuses another runner, and a file the run was not given', async () => {
    const held = await claimed();
    const other = await claimed();

    await read(other.token, held.runId, held.attachmentId).expect(404);
    await read(held.token, held.runId, other.attachmentId).expect(404);
  });

  it('refuses the runner of a run that has finished', async () => {
    const held = await claimed();

    await http()
      .post(`/api/runs/${held.runId}/completion`)
      .set('Authorization', `Bearer ${held.token}`)
      .send({ exitCode: 0, failed: false, sessionId: 'session_1', kept: true })
      .expect(200);

    const after = await read(held.token, held.runId, held.attachmentId);

    expect([401, 404]).toContain(after.status);
  });
});
