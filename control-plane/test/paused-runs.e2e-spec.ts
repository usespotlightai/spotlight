import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

interface Said {
  readonly position: number;
  readonly body: string;
}

interface InboxItem {
  readonly id: string;
  readonly taskId: string;
  readonly working: boolean;
  readonly runId: string | null;
}

const HOST = `host-paused-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'p'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BACKLOG = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const DEPLOY = randomUUID();
const SHA256 = 'a'.repeat(64);

const archiveStore: WorkspaceArchiveStorePort = {
  grantUpload: async (archive) => ({
    url: `https://archives.test/${archive.id.value}`,
    headers: {},
  }),
  stored: async (archive) => ({ size: archive.size, digest: archive.digest }),
  grantDownload: async (archive) =>
    `https://archives.test/${archive.id.value}?download`,
  remove: async () => {},
};

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

const http = () => served(app);

const runner = (token: string) => ({
  get: (path: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

const presentHost = async () => {
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      session: 'session_1',
      name: 'build-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 4,
      running: [],
      images: [
        {
          image: IMAGE,
          usual: true,
          harnesses: [
            { id: 'dev', models: [] },
            { id: 'claude-code', models: [] },
          ],
        },
      ],
    })
    .expect(200);
};

const claimed = async (runId: string): Promise<string> => {
  await presentHost();

  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  expect(handed.work.run.id).toBe(runId);

  return handed.token;
};

const aTaskWithLeasedRun = async (
  at = BUILD,
): Promise<{ taskId: string; runId: string }> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: at,
    title: 'Drain the queue',
    raisedAtStationId: at,
    raisedById: team.owner.value,
    assigneeId: team.owner.value,
    currentRunId: runId,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId,
    taskRevision: 0,
    stationId: at,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['review', 'ship', 'done'], noteLimit: 0 },
      continuity: { key: `${taskId}:${at}` },
    },
  });

  return { taskId, runId };
};

const askingForReview = {
  exitCode: 0,
  failed: false,
  outcome: { next: 'review', note: 'Which queue should I drain?' },
  sessionId: 'session_1',
  kept: true,
};

const runRow = async (runId: string) => {
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return row;
};

const taskRow = async (taskId: string) => {
  const [row] = await db
    .select()
    .from(schema.task)
    .where(eq(schema.task.id, taskId));

  return row;
};

const inboxItemOf = (taskId: string): Promise<InboxItem> =>
  eventually(async () =>
    (
      (
        await http()
          .get(`/api/workspaces/${team.slug}/inbox`)
          .set(TEST_USER_HEADER, team.owner.value)
          .expect(200)
      ).body as InboxItem[]
    ).find((each) => each.taskId === taskId),
  );

const runIn = (runId: string, state: string) =>
  eventually(async () => {
    const row = await runRow(runId);

    return row?.state === state ? row : null;
  });

const answered = async (taskId: string, body: string) => {
  const item = await inboxItemOf(taskId);

  await http()
    .post(`/api/workspaces/${team.slug}/inbox/${item.id}/answer`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send({ body })
    .expect(204);
};

const journalled = (token: string, runId: string, message: string) =>
  runner(token)
    .post(`/api/runs/${runId}/events`, {
      events: [
        {
          seq: 1,
          type: 'output',
          at: new Date().toISOString(),
          message: 'archive',
          data: Buffer.from(message).toString('base64'),
        },
      ],
    })
    .expect(204);

beforeAll(async () => {
  app = await openApp((module) =>
    module.overrideProvider(WORKSPACE_ARCHIVE_STORE).useValue(archiveStore),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `paused-${randomUUID().slice(0, 8)}`,
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
      id: BACKLOG,
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
      id: SHIP,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: DEPLOY,
      lineId: DELIVERY,
      key: 'deploy',
      name: 'Deploy',
      position: 3,
      kind: 'work',
      harness: 'claude-code',
      finishes: true,
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 4,
      kind: 'completed',
    },
  ]);
  await db.insert(schema.stationRoute).values({
    stationId: BUILD,
    toStationId: SHIP,
  });

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

describe('a run that asks a person', () => {
  it('pauses when its runner reports the turn asked for review, keeping the task and waiting for the answer', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    const completed = await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);

    expect(completed.body).toEqual({ waiting: true });
    expect((await runRow(runId))?.state).toBe('waiting');

    const item = await inboxItemOf(taskId);
    expect((await taskRow(taskId))?.currentRunId).toBe(runId);
    expect((await taskRow(taskId))?.sessionId).toBe('session_1');
    expect(item.working).toBe(false);
    expect(item.runId).toBe(runId);

    const waiting = await runner(token)
      .get(`/api/runs/${runId}/messages`)
      .expect(200);
    expect(waiting.body).toEqual([]);

    const renewed = await runner(token)
      .post(`/api/runs/${runId}/lease`)
      .expect(201);
    expect(renewed.body).toEqual({ stop: false });
  });

  it('delivers an answer given while it waits warm into the same run, which parking then leaves working', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);

    await answered(taskId, 'The default one.');

    const run = await runIn(runId, 'claimed');
    expect(run?.attempt).toBe(1);
    expect((await inboxItemOf(taskId)).working).toBe(true);

    const pending = (
      await runner(token).get(`/api/runs/${runId}/messages`).expect(200)
    ).body as Said[];
    expect(pending.map((each) => each.body)).toEqual(['The default one.']);

    const parking = await runner(token)
      .post(`/api/runs/${runId}/parked`)
      .expect(200);
    expect(parking.body).toEqual({ parked: false });

    await runner(token)
      .post(`/api/runs/${runId}/messages/delivered`, {
        upTo: pending[0]?.position,
      })
      .expect(204);
    expect(
      (await runner(token).get(`/api/runs/${runId}/messages`).expect(200)).body,
    ).toEqual([]);

    const again = await runner(token)
      .post(`/api/runs/${runId}/completion`, {
        exitCode: 0,
        failed: false,
        outcome: { next: 'ship', note: 'Drained.' },
      })
      .expect(200);
    expect(again.body).toEqual({ waiting: false });
    expect((await runRow(runId))?.state).toBe('completed');

    const runs = (
      await http()
        .get(`/api/teams/${team.teamId.value}/tasks/${taskId}/runs`)
        .set(TEST_USER_HEADER, team.owner.value)
        .expect(200)
    ).body as { id: string }[];
    expect(runs.filter((each) => each.id === runId)).toHaveLength(1);
  });

  it('parks after the grace period, and an answer requeues the same run as a new attempt that restores the archive', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const first = await claimed(runId);

    await journalled(first, runId, 'before the question');
    const granted = (
      await runner(first)
        .post(`/api/runs/${runId}/workspace-archive`, {
          size: 2_048,
          sha256: SHA256,
        })
        .expect(201)
    ).body as { id: string };
    await runner(first)
      .post(`/api/runs/${runId}/workspace-archive/${granted.id}/sealed`)
      .expect(204);
    await runner(first)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);

    const parking = await runner(first)
      .post(`/api/runs/${runId}/parked`)
      .expect(200);
    expect(parking.body).toEqual({ parked: true });

    const parked = await runRow(runId);
    expect(parked?.state).toBe('parked');
    expect(parked?.claimedBy).toBeNull();
    expect(parked?.parkedAttempts).toEqual([1]);
    await runner(first).get(`/api/runs/${runId}/messages`).expect(404);

    await answered(taskId, 'The default one.');

    const requeued = await runIn(runId, 'queued');
    expect(requeued?.attempt).toBe(2);
    expect(requeued?.spec).toMatchObject({
      continuity: {
        key: `${taskId}:${BUILD}`,
        sessionId: 'session_1',
        resumes: true,
      },
    });
    expect((await taskRow(taskId))?.currentRunId).toBe(runId);

    const second = await claimed(runId);
    expect(second).not.toBe(first);

    const restored = await runner(second)
      .get(`/api/runs/${runId}/workspace-archive`)
      .expect(200);
    expect(restored.body).toMatchObject({ id: granted.id, sha256: SHA256 });

    const pending = (
      await runner(second).get(`/api/runs/${runId}/messages`).expect(200)
    ).body as Said[];
    expect(pending.map((each) => each.body)).toEqual(['The default one.']);

    await journalled(second, runId, 'after the answer');
    const journal = (
      await http()
        .get(`/api/workspaces/${team.slug}/inbox/tasks/${taskId}/journal`)
        .set(TEST_USER_HEADER, team.owner.value)
        .expect(200)
    ).body as { runId: string; attempt: number }[];
    expect(
      journal
        .filter((each) => each.runId === runId)
        .map((each) => each.attempt)
        .sort(),
    ).toEqual([1, 2]);
  });

  it('ends a parked run as its turn ended when a person parks its task back in the backlog', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);
    await runner(token).post(`/api/runs/${runId}/parked`).expect(200);
    await inboxItemOf(taskId);

    await http()
      .post(
        `/api/teams/${team.teamId.value}/lines/${DELIVERY}/tasks/${taskId}/move`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ stationId: BACKLOG, revision: 0 })
      .expect((response) => expect(response.status).toBeLessThan(300));

    const ended = await runIn(runId, 'completed');
    expect(ended?.stopped).toBe(false);
    expect(ended?.exitCode).toBe(0);
    expect((await taskRow(taskId))?.currentRunId).not.toBe(runId);
  });

  it('ends a run waiting warm as its turn ended when a person parks its task back in the backlog, so its runner lets the sandbox go', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);
    await inboxItemOf(taskId);

    await http()
      .post(
        `/api/teams/${team.teamId.value}/lines/${DELIVERY}/tasks/${taskId}/move`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ stationId: BACKLOG, revision: 0 })
      .expect((response) => expect(response.status).toBeLessThan(300));

    const ended = await runIn(runId, 'completed');
    expect(ended?.stopped).toBe(false);
    await runner(token)
      .post(`/api/runs/${runId}/lease`)
      .expect((response) =>
        expect(response.status).toBeGreaterThanOrEqual(400),
      );
  });

  it('takes a message in the run chat as the answer, taking the same run up once', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);
    await inboxItemOf(taskId);

    await http()
      .post(`/api/teams/${team.teamId.value}/runs/${runId}/say`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ body: 'Drain the default one.' })
      .expect((response) => expect(response.status).toBeLessThan(300));

    const working = await runIn(runId, 'claimed');
    expect(working?.attempt).toBe(1);
    const pending = (
      await runner(token).get(`/api/runs/${runId}/messages`).expect(200)
    ).body as Said[];
    expect(pending.map((each) => each.body)).toEqual([
      'Drain the default one.',
    ]);
    expect((await inboxItemOf(taskId)).working).toBe(true);
  });

  it('reports whether a turn would wait for a person before the runner keeps its workspace', async () => {
    const { runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    const review = await runner(token)
      .post(`/api/runs/${runId}/completion/asks`, askingForReview)
      .expect(200);
    const ship = await runner(token)
      .post(`/api/runs/${runId}/completion/asks`, {
        exitCode: 0,
        failed: false,
        outcome: { next: 'ship' },
      })
      .expect(200);

    expect(review.body).toEqual({ asks: true });
    expect(ship.body).toEqual({ asks: false });
    expect((await runRow(runId))?.state).toBe('claimed');
  });

  it('ends the run as before, putting the task to the person, when the workspace was not kept', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    const completed = await runner(token)
      .post(`/api/runs/${runId}/completion`, {
        ...askingForReview,
        kept: false,
      })
      .expect(200);

    expect(completed.body).toEqual({ waiting: false });
    expect((await runRow(runId))?.state).toBe('completed');
    await eventually(async () =>
      (await inboxItemOf(taskId)).runId === null ? true : null,
    );
  });

  it('writes only one of an answer and a parking read from the same waiting run', async () => {
    const { runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, askingForReview)
      .expect(200);
    const runs = app.get(DrizzleRunRepository);
    const read = await runs.findById(RunId.of(runId));

    if (!read) {
      throw new Error('the waiting run could not be read');
    }

    const leasedBy = read.claimedBy;

    if (!leasedBy) {
      throw new Error('no runner has a lease on the waiting run');
    }

    await runs.save(read.park(leasedBy, new Date()));

    await expect(runs.save(read.resumed())).rejects.toBeInstanceOf(
      RunVersionConflictError,
    );
    expect((await runRow(runId))?.state).toBe('parked');
  });
});

const said = (runId: string, body: string) =>
  http()
    .post(`/api/teams/${team.teamId.value}/runs/${runId}/say`)
    .set(TEST_USER_HEADER, team.owner.value)
    .send({ body })
    .expect(204);

describe('a message in a run chat', () => {
  it('reaches the run still working the task, starting no other', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    const token = await claimed(runId);

    await said(runId, 'Drain the default one first.');

    const pending = (
      await runner(token).get(`/api/runs/${runId}/messages`).expect(200)
    ).body as Said[];
    expect(pending.map((each) => each.body)).toEqual([
      'Drain the default one first.',
    ]);
    expect((await runRow(runId))?.state).toBe('claimed');
    expect((await taskRow(taskId))?.currentRunId).toBe(runId);
  });

  it('starts the station again for a task finished there, taking up its conversation', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun(DEPLOY);
    const token = await claimed(runId);
    await runner(token)
      .post(`/api/runs/${runId}/completion`, {
        exitCode: 0,
        failed: false,
        outcome: { next: 'done', note: 'Deployed.' },
        sessionId: 'session_1',
      })
      .expect(200);
    await eventually(async () =>
      (await taskRow(taskId))?.finishedAt ? true : null,
    );

    await said(runId, 'Deploy the docs with it too.');

    const task = await taskRow(taskId);
    const next = task?.currentRunId ?? '';
    expect(task?.finishedAt).toBeNull();
    expect(task?.stationId).toBe(DEPLOY);
    expect(next).not.toBe(runId);
    expect((await runRow(runId))?.state).toBe('completed');

    const queued = await runIn(next, 'queued');
    expect(queued?.stationId).toBe(DEPLOY);
    expect(queued?.spec).toMatchObject({
      briefing: expect.stringContaining('Deploy the docs with it too.'),
      continuity: { key: `task-${taskId}`, sessionId: 'session_1' },
    });

    await claimed(next);
  });

  it('answers a conflict once the task has moved on from the run’s station', async () => {
    const { taskId, runId } = await aTaskWithLeasedRun();
    await claimed(runId);

    await http()
      .post(
        `/api/teams/${team.teamId.value}/lines/${DELIVERY}/tasks/${taskId}/move`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ stationId: BACKLOG, revision: 0 })
      .expect(200);

    const rejected = await http()
      .post(`/api/teams/${team.teamId.value}/runs/${runId}/say`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ body: 'Drain it after all.' })
      .expect(409);

    expect(rejected.body.message).toContain('has moved on from that station');
    expect((await taskRow(taskId))?.currentRunId).toBeNull();
  });
});

describe('a run queued while an earlier run of its task is still leased', () => {
  const claimsNext = async (): Promise<string[]> => {
    const claimed: string[] = [];
    const runs = app.get(DrizzleRunRepository);

    for (let taken = 0; taken < 5; taken++) {
      const next = await runs.claimNext(
        {
          runner: RunnerId.of(`runner-${randomUUID()}`),
          workspaceId: team.workspaceId,
          harnesses: [HarnessId.of('dev')],
          terms: RunnerTerms.of(['linux']),
          claims: 'any',
        },
        new Date(),
      );

      if (!next) {
        return claimed;
      }

      claimed.push(next.id.value);
    }

    return claimed;
  };

  it.each([
    ['the same station', BUILD],
    ['another station', DEPLOY],
  ])(
    'is claimed only once the earlier run has ended, so the two never share the task’s workspace, at %s',
    async (_, station) => {
      const { taskId, runId } = await aTaskWithLeasedRun();
      const token = await claimed(runId);
      const next = randomUUID();
      const [earlier] = await db
        .select()
        .from(schema.run)
        .where(eq(schema.run.id, runId));
      await db.insert(schema.run).values({
        ...(earlier as typeof schema.run.$inferInsert),
        id: next,
        stationId: station,
        state: 'queued',
        claimedBy: null,
        leaseExpiresAt: null,
        attempt: 1,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db
        .update(schema.task)
        .set({ currentRunId: next })
        .where(eq(schema.task.id, taskId));

      expect(await claimsNext()).not.toContain(next);

      await runner(token)
        .post(`/api/runs/${runId}/completion`, {
          exitCode: 0,
          failed: false,
          stopped: true,
        })
        .expect(200);
      expect((await runRow(runId))?.state).not.toBe('claimed');

      expect(await claimsNext()).toContain(next);
    },
  );
});
