import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-start-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'p'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

const http = () => served(app);

interface Held {
  readonly runId: string;
  readonly taskId: string | null;
  readonly token: string;
  readonly attempt: number;
}

const report = (held: Held, body: object, runId = held.runId) =>
  http()
    .post(`/api/runs/${runId}/starting-point`)
    .set('Authorization', `Bearer ${held.token}`)
    .send(body);

const atApi = (attempt = 1) => ({
  attempt,
  archiveId: null,
  checkouts: [{ path: 'api', commit: COMMIT }],
});

const claimed = async (runId: string): Promise<string> => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      session: 'session_1',
      name: 'build-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 8,
      running: [],
      images: [
        { image: IMAGE, usual: true, harnesses: [{ id: 'dev', models: [] }] },
      ],
    })
    .expect(200);

  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string; attempt: number } } };

  expect(handed.work.run.id).toBe(runId);
  expect(handed.work.run.attempt).toBe(1);

  return handed.token;
};

const spec = (key: string) => ({
  checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
  command: { executable: 'sh', args: [] },
  briefing: 'Drain the queue.',
  handover: { options: ['review'], noteLimit: 0 },
  continuity: { key },
  startingPoint: true,
});

const aHeldTaskRun = async (): Promise<Held> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: 'Drain the queue',
    raisedAtStationId: BUILD,
    raisedById: team.owner.value,
    currentRunId: runId,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId,
    taskRevision: 0,
    stationId: BUILD,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: spec(`task-${taskId}`),
  });

  return { runId, taskId, token: await claimed(runId), attempt: 1 };
};

const aHeldChatRun = async (): Promise<Held> => {
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
    id: runId,
    workspaceId: team.workspaceId.value,
    chatId,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: spec(`chat-${chatId}`),
  });

  return { runId, taskId: null, token: await claimed(runId), attempt: 1 };
};

const anArchiveOf = async (
  taskId: string,
  sealed: boolean,
): Promise<string> => {
  const id = randomUUID();

  await db.insert(schema.workspaceArchive).values({
    id,
    workspaceId: team.workspaceId.value,
    continuityKey: `task-${taskId}`,
    taskId,
    grantedToRunId: randomUUID(),
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: new Date(),
    sealedAt: sealed ? new Date() : null,
  });

  return id;
};

const runRow = async (runId: string) => {
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return row;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `start-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a runner saying where its run started', () => {
  it('records the sealed archive the run restored and the commit each checkout began at', async () => {
    const held = await aHeldTaskRun();
    const archiveId = await anArchiveOf(held.taskId as string, true);

    await report(held, { ...atApi(), archiveId }).expect(204);
    await report(held, { ...atApi(), archiveId }).expect(204);

    const row = await runRow(held.runId);
    expect(row?.startedFromArchiveId).toBe(archiveId);
    expect(row?.startedFromCheckouts).toEqual([
      { path: 'api', commit: COMMIT },
    ]);
    expect(row?.startedFromAttempt).toBe(1);
  });

  it('refuses a second report on the same attempt that says it started elsewhere', async () => {
    const held = await aHeldTaskRun();

    await report(held, atApi()).expect(204);
    await report(held, {
      ...atApi(),
      checkouts: [{ path: 'api', commit: 'b'.repeat(40) }],
    }).expect(409);
  });

  it('refuses a report from an attempt the run is not on', async () => {
    const held = await aHeldTaskRun();

    await report(held, atApi(2)).expect(409);
    expect((await runRow(held.runId))?.startedFromAt).toBeNull();
  });

  it('refuses a run that works a chat', async () => {
    const held = await aHeldChatRun();

    await report(held, { ...atApi(), checkouts: [] }).expect(409);
  });

  it('refuses a runner that does not hold the run', async () => {
    const held = await aHeldTaskRun();
    const other = await aHeldTaskRun();

    await report(other, atApi(), held.runId).expect(409);
  });

  it('says there is no such run', async () => {
    const held = await aHeldTaskRun();

    await report(held, atApi(), randomUUID()).expect(404);
  });

  it('refuses an archive the run could not have restored', async () => {
    const held = await aHeldTaskRun();
    const other = await aHeldTaskRun();
    const unsealed = await anArchiveOf(held.taskId as string, false);
    const ofAnotherTask = await anArchiveOf(other.taskId as string, true);

    for (const archiveId of [unsealed, ofAnotherTask, randomUUID()]) {
      await report(held, { ...atApi(), archiveId }).expect(422);
    }
    expect((await runRow(held.runId))?.startedFromAt).toBeNull();
  });

  it('refuses checkouts other than the ones the run was given, and a body it cannot read', async () => {
    const held = await aHeldTaskRun();

    for (const body of [
      { ...atApi(), checkouts: [{ path: 'web', commit: COMMIT }] },
      { ...atApi(), checkouts: [{ path: 'api', commit: 'abc123' }] },
      { ...atApi(), checkouts: 'api' },
      { ...atApi(), checkouts: [null, 7] },
      { ...atApi(), archiveId: 42 },
      { archiveId: null, checkouts: [{ path: 'api', commit: COMMIT }] },
      {
        ...atApi(),
        checkouts: Array.from({ length: 101 }, (_, at) => ({
          path: `repo_${at}`,
          commit: COMMIT,
        })),
      },
    ]) {
      await report(held, body).expect(422);
    }
    expect((await runRow(held.runId))?.startedFromAt).toBeNull();
  });
});
