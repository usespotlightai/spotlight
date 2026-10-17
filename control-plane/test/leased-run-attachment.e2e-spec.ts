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
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-attachment-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'a'.repeat(8)}${randomUUID().replaceAll('-', '')}`;

const attachmentStore = {
  received: async () => [],
  taken: async () => undefined,
  open: async () => ({
    bytes: new Uint8Array([7, 7, 7]),
    contentType: 'image/png',
  }),
} as unknown as AttachmentStorePort;

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

interface LeasedRun {
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
    kind: 'message',
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

const claimed = async (): Promise<LeasedRun> => {
  const queued = await aChatRun();
  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(assignment.work.run.id).toBe(queued.runId);

  return { ...queued, token: assignment.token };
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
  team = await createTeam(
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
      bootId: 'boot_1',
      name: 'chat-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('reading a file attached to a leased chat run', () => {
  it('hands the runner with the lease on the run a file attached to its chat, byte for byte', async () => {
    const leased = await claimed();

    const file = await read(leased.token, leased.runId, leased.attachmentId)
      .expect(200)
      .buffer(true);

    expect([...(file.body as Buffer)]).toEqual([7, 7, 7]);
  });

  it('denies another runner, and a file not attached to the run', async () => {
    const leased = await claimed();
    const other = await claimed();

    await read(other.token, leased.runId, leased.attachmentId).expect(404);
    await read(leased.token, leased.runId, other.attachmentId).expect(404);
  });

  it('denies the runner of a run that has finished', async () => {
    const leased = await claimed();

    await http()
      .post(`/api/runs/${leased.runId}/completion`)
      .set('Authorization', `Bearer ${leased.token}`)
      .send({
        exitCode: 0,
        failed: false,
        sessionId: 'session_1',
        archived: true,
      })
      .expect(200);

    const after = await read(leased.token, leased.runId, leased.attachmentId);

    expect([401, 404]).toContain(after.status);
  });
});
