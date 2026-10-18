import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-start-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'p'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

interface LeasedRun {
  readonly runId: string;
  readonly taskId: string | null;
  readonly token: string;
  readonly attempt: number;
}

const report = (leased: LeasedRun, body: object, runId = leased.runId) =>
  http()
    .post(`/api/runs/${runId}/starting-point`)
    .set('Authorization', `Bearer ${leased.token}`)
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
  ).body as { token: string; work: { run: { id: string; attempt: number } } };

  expect(assignment.work.run.id).toBe(runId);
  expect(assignment.work.run.attempt).toBe(1);

  return assignment.token;
};

const spec = (key: string) => ({
  checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
  command: { executable: 'sh', args: [] },
  briefing: 'Drain the queue.',
  handover: { options: ['review'], noteLimit: 0 },
  resume: { key },
  startingPoint: true,
});

const aLeasedTaskRun = async (): Promise<LeasedRun> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: 'Drain the queue',
    originStationId: BUILD,
    createdById: team.owner.value,
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

const aLeasedChatRun = async (): Promise<LeasedRun> => {
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
  completed: boolean,
): Promise<string> => {
  const id = randomUUID();

  await db.insert(schema.workspaceArchive).values({
    id,
    workspaceId: team.workspaceId.value,
    resumeKey: `task-${taskId}`,
    taskId,
    grantedToRunId: randomUUID(),
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: new Date(),
    completedAt: completed ? new Date() : null,
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
  team = await createTeam(
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
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a runner saying where its run started', () => {
  it('records the completed archive the run restored and the commit each checkout began at', async () => {
    const leased = await aLeasedTaskRun();
    const archiveId = await anArchiveOf(leased.taskId as string, true);

    await report(leased, { ...atApi(), archiveId }).expect(204);
    await report(leased, { ...atApi(), archiveId }).expect(204);

    const row = await runRow(leased.runId);
    expect(row?.startedFromArchiveId).toBe(archiveId);
    expect(row?.startedFromCheckouts).toEqual([
      { path: 'api', commit: COMMIT },
    ]);
    expect(row?.startedFromAttempt).toBe(1);
  });

  it('rejects a second report on the same attempt that says it started elsewhere', async () => {
    const leased = await aLeasedTaskRun();

    await report(leased, atApi()).expect(204);
    await report(leased, {
      ...atApi(),
      checkouts: [{ path: 'api', commit: 'b'.repeat(40) }],
    }).expect(409);
  });

  it('rejects a report from an attempt the run is not on', async () => {
    const leased = await aLeasedTaskRun();

    await report(leased, atApi(2)).expect(409);
    expect((await runRow(leased.runId))?.startedFromAt).toBeNull();
  });

  it('rejects a run that works a chat', async () => {
    const leased = await aLeasedChatRun();

    await report(leased, { ...atApi(), checkouts: [] }).expect(409);
  });

  it('denies a runner that does not have a lease on the run', async () => {
    const leased = await aLeasedTaskRun();
    const other = await aLeasedTaskRun();

    await report(other, atApi(), leased.runId).expect(409);
  });

  it('says there is no such run', async () => {
    const leased = await aLeasedTaskRun();

    await report(leased, atApi(), randomUUID()).expect(404);
  });

  it('rejects an archive the run could not have restored', async () => {
    const leased = await aLeasedTaskRun();
    const other = await aLeasedTaskRun();
    const incomplete = await anArchiveOf(leased.taskId as string, false);
    const ofAnotherTask = await anArchiveOf(other.taskId as string, true);

    for (const archiveId of [incomplete, ofAnotherTask, randomUUID()]) {
      await report(leased, { ...atApi(), archiveId }).expect(422);
    }
    expect((await runRow(leased.runId))?.startedFromAt).toBeNull();
  });

  it('rejects checkouts other than the ones the run received, and a body it cannot read', async () => {
    const leased = await aLeasedTaskRun();

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
      await report(leased, body).expect(422);
    }
    expect((await runRow(leased.runId))?.startedFromAt).toBeNull();
  });
});
