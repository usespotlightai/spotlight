import { randomUUID } from 'node:crypto';

import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { BetterAuthSessionReader } from '@identity/infrastructure/auth/better-auth.session-reader';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { ne } from 'drizzle-orm';
import type { Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import {
  queryRoundsDuring,
  queryRoundsOf,
  type Rounds,
} from './support/query-rounds';
import { deleteRunnersOf } from './support/runners';
import { aDispatch, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

interface InboxItem {
  readonly kind: string;
  readonly id: string;
  readonly taskId: string;
}

const HOST = `host-rounds-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'r'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

const hostReport = {
  bootId: 'boot_1',
  name: 'build-box',
  release: '0.1.0',
  containerRuntime: 'docker',
  capacity: 8,
  running: [],
  images: [
    { image: IMAGE, isDefault: true, harnesses: [{ id: 'dev', models: [] }] },
  ],
};

const aTaskWithQueuedRun = async (): Promise<{
  taskId: string;
  runId: string;
}> => {
  const taskId = randomUUID();
  const runId = randomUUID();

  await db.insert(schema.task).values({
    id: taskId,
    branch: `feat/rounds-${taskId}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: 'Drain the queue',
    originStationId: BUILD,
    createdById: team.owner.value,
    assigneeId: team.owner.value,
    currentRunId: runId,
  });
  await db.insert(schema.run).values({
    ...requestedByTask(taskId, { revision: 0 }),
    id: runId,
    workspaceId: team.workspaceId.value,
    harness: 'dev',
    state: 'queued',
    placement: [['linux']],
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['review', 'ship', 'done'], noteLimit: 0 },
      resume: {},
    },
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      taskId,
      stationId: BUILD,
    }),
  );

  return { taskId, runId };
};

const claimed = async (runId: string): Promise<string> => {
  await db
    .update(schema.sandbox)
    .set({ state: 'gone', goneAt: new Date() })
    .where(ne(schema.sandbox.state, 'gone'));
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send(hostReport)
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

const askingForReview = {
  exitCode: 0,
  failed: false,
  handover: { next: 'review', note: 'Which queue should I drain?' },
  sessionId: 'session_1',
};

const waitingTask = async (): Promise<string> => {
  const { taskId, runId } = await aTaskWithQueuedRun();
  const token = await claimed(runId);

  await http()
    .post(`/api/runs/${runId}/completion`)
    .set('Authorization', `Bearer ${token}`)
    .send(askingForReview)
    .expect(204);

  return taskId;
};

const inbox = () =>
  http()
    .get(`/api/workspaces/${team.slug}/inbox`)
    .set(TEST_USER_HEADER, team.owner.value);

const inboxItems = async (count: number): Promise<InboxItem[]> =>
  eventually(async () => {
    const items = ((await inbox().expect(200)).body as { items: InboxItem[] })
      .items;

    return items.filter((each) => each.kind === 'task').length >= count
      ? items
      : null;
  });

let leased: { runId: string; token: string };
let waiting: InboxItem;

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `rounds-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await insertStations(db, [
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: SHIP,
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'dev',
    },
    {
      id: randomUUID(),
      workspaceId: team.workspaceId.value,
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 3,
      kind: 'completed',
    },
  ]);
  await db.insert(schema.stationRoute).values({
    stationId: BUILD,
    toStationId: SHIP,
  });
  await http()
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);

  for (let each = 0; each < 3; each += 1) {
    await waitingTask();
  }

  const items = await inboxItems(3);
  waiting = items.find((each) => each.kind === 'task') as InboxItem;

  const run = await aTaskWithQueuedRun();
  leased = { runId: run.runId, token: await claimed(run.runId) };
}, 120_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

const withinBudget = (found: Rounds, budget: number) =>
  expect(found.rounds, found.texts.join('\n')).toBeLessThanOrEqual(budget);

const asOwner = (test: Test) => test.set(TEST_USER_HEADER, team.owner.value);

const asRunner = (test: Test) =>
  test.set('Authorization', `Bearer ${leased.token}`);

describe('database round trips a hot route makes, one after another', () => {
  it('reads a signed-in person in one', async () => {
    const token = `session-${randomUUID()}`;
    await db.insert(schema.session).values({
      id: randomUUID(),
      token,
      userId: team.owner.value,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      updatedAt: new Date(),
    });
    const reader = new BetterAuthSessionReader(app.get(AUTH));

    withinBudget(
      await queryRoundsDuring(async () => {
        expect((await reader.readBearer(token))?.id).toBe(team.owner.value);
      }),
      1,
    );
  });

  it('lists the inbox in seven', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) => probe(inbox()).expect(200)),
      7,
    );
  });

  it('opens an inbox item in seven', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          asOwner(
            http().get(`/api/workspaces/${team.slug}/inbox/${waiting.id}`),
          ),
        ).expect(200),
      ),
      7,
    );
  });

  it('opens a task in four', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          asOwner(
            http().get(
              `/api/teams/${team.teamId.value}/tasks/${waiting.taskId}`,
            ),
          ),
        ).expect(200),
      ),
      4,
    );
  });

  it('lists the tasks of a team in four', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          asOwner(http().get(`/api/teams/${team.teamId.value}/tasks`)),
        ).expect(200),
      ),
      4,
    );
  });

  it('renews a lease in seven', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          asRunner(http().post(`/api/runs/${leased.runId}/lease`)).send({}),
        ).expect(201),
      ),
      7,
    );
  });

  it('gives a runner its messages in seven', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          asRunner(http().get(`/api/runs/${leased.runId}/messages`)),
        ).expect(200),
      ),
      7,
    );
  });

  it('journals run events in three', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(asRunner(http().post(`/api/runs/${leased.runId}/events`)))
          .send({
            events: [
              {
                seq: 1,
                type: 'output',
                at: new Date().toISOString(),
                message: 'stdout',
                data: Buffer.from('hello').toString('base64'),
              },
            ],
          })
          .expect(204),
      ),
      3,
    );
  });

  it('records a host report in five', async () => {
    withinBudget(
      await queryRoundsOf(app, (probe) =>
        probe(
          http()
            .put(`/api/hosts/${HOST}`)
            .set('Authorization', `Bearer ${POOL_TOKEN}`),
        )
          .send(hostReport)
          .expect(200),
      ),
      5,
    );
  });
});
