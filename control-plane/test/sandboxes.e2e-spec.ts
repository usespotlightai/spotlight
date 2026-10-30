import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import { eq, inArray } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const IMAGE = 'ghcr.io/acme/runner:main';

const HOST = 'host-sandboxes-1';

const tokenOf = (seed: string): string =>
  `${seed.repeat(8)}${randomUUID().replaceAll('-', '')}`;

describe('sandboxes (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;
  let token: string;

  const http = () => served(app);

  const queue = async (
    input: { key?: string; chatId?: string | null } = {},
  ) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId,
      harness: 'dev',
      state: 'queued',
      chatId: input.chatId ?? null,
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        resume: { key: input.key ?? `task-${id}` },
      },
    });

    return id;
  };

  const claim = (sandbox?: string) =>
    http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${token}`)
      .send({ host: HOST, image: IMAGE, sandbox });

  const complete = (runId: string, runnerToken: string) =>
    http()
      .post(`/api/runs/${runId}/completion`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ exitCode: 0, failed: false })
      .expect(204);

  const idleAndReady = async (key: string) => {
    const runId = await queue({ key });
    const claimed = await claim().expect(200);
    const sandboxId: string = claimed.body.sandboxId;
    await heartbeat([sandboxId]).expect(200);
    await complete(runId, claimed.body.token);
    await eventually(async () =>
      (await sandboxRow(sandboxId))?.idleSince ? true : null,
    );

    return sandboxId;
  };

  const heartbeat = (sandboxes: string[] = []) =>
    http()
      .put(`/api/hosts/${HOST}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bootId: 'boot_1',
        name: 'build-box',
        release: '0.1.0',
        containerRuntime: 'docker',
        capacity: 2,
        sandboxes: sandboxes.map((id) => ({ id })),
        images: [
          {
            image: IMAGE,
            isDefault: true,
            harnesses: [{ id: 'dev', models: [] }],
          },
        ],
      });

  const sandboxRow = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.sandbox)
      .where(eq(schema.sandbox.id, id));

    return row ?? null;
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `sandboxes-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    token = tokenOf('s');
    await http()
      .post(`/api/resources/workspaces/${workspaceId}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'sandboxes', token })
      .expect(201);
    await heartbeat().expect(200);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await deleteRunnersOf(db, workspaceId);
    await unseat();
  });

  it('starts a sandbox for each claimed run, held by the run, under its resume key', async () => {
    const runId = await queue({ key: 'task-task_1' });

    const claimed = await claim().expect(200);

    expect(claimed.body.sandboxId).toEqual(expect.any(String));
    expect(await sandboxRow(claimed.body.sandboxId)).toMatchObject({
      workspaceId,
      key: 'task-task_1',
      hostId: HOST,
      state: 'starting',
      leases: [{ kind: 'run', holder: runId, renewedAt: expect.any(String) }],
      idleSince: null,
    });
  });

  it('drains a reported sandbox once its run ended and it stayed idle past the grace, then loses it once the host stops reporting it', async () => {
    const runId = await queue();
    const claimed = await claim().expect(200);
    const sandboxId: string = claimed.body.sandboxId;

    await expect(
      heartbeat([sandboxId, 'sandbox-unknown']).expect(200),
    ).resolves.toMatchObject({ body: { drain: ['sandbox-unknown'] } });
    expect((await sandboxRow(sandboxId))?.state).toBe('ready');

    await complete(runId, claimed.body.token);
    const released = await eventually(async () => {
      const row = await sandboxRow(sandboxId);
      return row?.idleSince ? row : null;
    });
    expect(released.leases).toEqual([]);

    await db
      .update(schema.sandbox)
      .set({ idleSince: new Date(Date.now() - 10 * 60_000 - 1_000) })
      .where(eq(schema.sandbox.id, sandboxId));
    await app.get(Sandboxes).drainIdle(new Date());

    expect((await sandboxRow(sandboxId))?.state).toBe('draining');
    await expect(heartbeat([sandboxId]).expect(200)).resolves.toMatchObject({
      body: { drain: [sandboxId] },
    });

    await heartbeat([]).expect(200);

    expect(await sandboxRow(sandboxId)).toMatchObject({
      state: 'gone',
      goneAt: expect.any(Date),
    });
  });

  it('runs the next run of a key in its ready sandbox, claimed only by that sandbox’s host for it', async () => {
    const sandboxId = await idleAndReady('task-task_3');
    const next = await queue({ key: 'task-task_3' });

    await claim().expect(204);
    const reused = await claim(sandboxId).expect(200);

    expect(reused.body).toMatchObject({
      sandboxId,
      reused: true,
      work: { kind: 'run', run: { id: next } },
    });
    expect(await sandboxRow(sandboxId)).toMatchObject({
      state: 'ready',
      leases: [{ kind: 'run', holder: next, renewedAt: expect.any(String) }],
      idleSince: null,
    });
  });

  it('takes nothing into a sandbox for a run of another key, nor into a sandbox with a run in it', async () => {
    const sandboxId = await idleAndReady('task-task_4');
    await queue({ key: 'task-task_5' });

    await claim(sandboxId).expect(204);

    const other = await claim().expect(200);
    expect(other.body.sandboxId).not.toBe(sandboxId);

    const busy = other.body.sandboxId as string;
    await heartbeat([sandboxId, busy]).expect(200);
    await queue({ key: 'task-task_5' });
    await claim(busy).expect(204);
  });

  it('starts a fresh sandbox for the next run of a key once its draining sandbox is gone', async () => {
    const sandboxId = await idleAndReady('task-task_6');
    await db
      .update(schema.sandbox)
      .set({ state: 'draining' })
      .where(eq(schema.sandbox.id, sandboxId));
    const next = await queue({ key: 'task-task_6' });

    await claim().expect(204);
    await heartbeat([]).expect(200);
    expect((await sandboxRow(sandboxId))?.state).toBe('gone');

    const fresh = await claim().expect(200);

    expect(fresh.body).toMatchObject({
      reused: false,
      work: { kind: 'run', run: { id: next } },
    });
    expect(fresh.body.sandboxId).not.toBe(sandboxId);
  });

  it('leaves the next run of a key to its sandbox while that sandbox starts', async () => {
    const first = await queue({ key: 'task-task_2' });
    const earlier = await claim().expect(200);
    await complete(first, earlier.body.token);
    await queue({ key: 'task-task_2' });

    await claim().expect(204);

    expect((await sandboxRow(earlier.body.sandboxId))?.state).toBe('starting');
  });

  it('hands out no second run of a chat while an earlier run of it holds its lease', async () => {
    const chatId = randomUUID();
    await queue({ key: `chat-${chatId}`, chatId });
    await claim().expect(200);
    await queue({ key: `chat-${chatId}`, chatId });

    await claim().expect(204);
  });
});
