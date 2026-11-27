import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { firstOf } from '@shared-kernel/domain/item-at';
import { eq, inArray, ne } from 'drizzle-orm';
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
import { bodyOf } from './support/body';
import { deleteRunnersOf, deleteRunsOf } from './support/runners';
import { requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const HOST = 'host-store-e2e-1';

const IMAGE = 'ghcr.io/acme/runner:main';

const STORE = 's3://acme-e2e/working-copies';

const WORKING_COPIES = { store: STORE, base: 'base-v1' };

const tokenOf = (character: string) =>
  `${character.repeat(8)}${randomUUID().replaceAll('-', '')}`;

describe('working copies kept by the hosts of a pool in a store of their hook (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let unseat: () => Promise<void>;
  let token: string;
  let poolId: string;

  const http = () => served(app);

  const resources = () => `/api/v1/resources/workspaces/${workspaceId}`;

  const createPool = (body: object) =>
    http()
      .post(`${resources()}/runner-pools`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const asHost = (method: 'get' | 'delete', path: string, with_ = token) =>
    http()[method](path).set('Authorization', `Bearer ${with_}`);

  const runner = (runToken: string) => ({
    get: (path: string) =>
      http().get(path).set('Authorization', `Bearer ${runToken}`),
    post: (path: string, body?: object) =>
      http()
        .post(path)
        .set('Authorization', `Bearer ${runToken}`)
        .send(body ?? {}),
  });

  const queue = async (taskId: string, resume: object = {}) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      ...requestedByTask(taskId),
      id,
      workspaceId,
      harness: 'dev',
      state: 'queued',
      placement: [['linux']],
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        resume,
      },
    });

    return id;
  };

  const claimed = async (runId: string): Promise<string> => {
    await db
      .update(schema.sandbox)
      .set({ state: 'gone', goneAt: new Date() })
      .where(ne(schema.sandbox.state, 'gone'));
    await http()
      .put(`/api/hosts/${HOST}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bootId: 'boot_1',
        name: 'build-box',
        release: '0.1.0',
        containerRuntime: 'docker',
        capacity: 4,
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

    const assignment = bodyOf<{ token: string; work: { run: { id: string } } }>(
      await http()
        .post('/api/hosts/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ host: HOST, image: IMAGE })
        .expect(200),
    );

    expect(assignment.work.run.id).toBe(runId);

    return assignment.token;
  };

  const finished = async (runId: string) => {
    await db
      .update(schema.run)
      .set({ state: 'completed', claimedBy: null, endedAt: new Date() })
      .where(eq(schema.run.id, runId));
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `store-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    unseat = seat.unseat;
    token = tokenOf('p');

    poolId = bodyOf<{ id: string }>(
      await createPool({
        key: 'hosts',
        labels: ['linux'],
        token,
        workingCopies: WORKING_COPIES,
      }).expect(201),
    ).id;
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${owner}`]));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId));
    await db
      .delete(schema.workingCopyArchive)
      .where(eq(schema.workingCopyArchive.workspaceId, workspaceId));
    await db
      .delete(schema.snapshotRemoval)
      .where(eq(schema.snapshotRemoval.workspaceId, workspaceId));
    await deleteRunsOf(db, workspaceId);
    await deleteRunnersOf(db, workspaceId);
    await unseat();
  });

  it('keeps where the hosts of a pull pool keep working copies, and tells its hosts', async () => {
    const pools = await http()
      .get(`/api/v1/resources/runner-pools/${poolId}`)
      .set(TEST_USER_HEADER, owner)
      .expect(200);
    const required = await asHost('get', '/api/hosts/requirements').expect(200);

    expect(pools.body).toMatchObject({ workingCopies: WORKING_COPIES });
    expect(required.body).toMatchObject({ workingCopies: WORKING_COPIES });
  });

  it('starts a new pool with Spotlight’s archives, and refuses a store for a pool that provisions', async () => {
    const other = tokenOf('q');
    await createPool({ key: 'archives', labels: ['linux'], token: other })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ workingCopies: null }),
      );
    const required = await asHost(
      'get',
      '/api/hosts/requirements',
      other,
    ).expect(200);

    const refused = await createPool({
      key: 'provisioned',
      labels: [],
      provision: {
        url: 'https://provision.example.com/runs',
        secret: `whsec_${Buffer.alloc(24, 1).toString('base64')}`,
      },
      workingCopies: WORKING_COPIES,
    });

    expect(required.body).toMatchObject({ workingCopies: null });
    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body)).toContain('workingCopies');
  });

  it('refuses a store name with spaces in it', async () => {
    const refused = await createPool({
      key: 'wrong',
      labels: [],
      token: tokenOf('r'),
      workingCopies: { store: 'team a' },
    });

    expect(refused.status).toBe(422);
    expect(JSON.stringify(refused.body)).toContain('workingCopies.store');
  });

  it('archives a run’s working copy as a snapshot the host makes, and gives the next run of the task the snapshot to open from', async () => {
    const taskId = randomUUID();
    const first = await queue(taskId);
    const firstToken = await claimed(first);

    const granted = bodyOf<{
      id: string;
      url: string | null;
      snapshot: { name: string };
    }>(
      await runner(firstToken)
        .post(`/api/runs/${first}/working-copy-archive`, {
          snapshot: { base: 'base-v1' },
        })
        .expect(201),
    );
    await runner(firstToken)
      .post(`/api/runs/${first}/working-copy-archive/${granted.id}/complete`)
      .expect(204);
    await finished(first);

    const second = await queue(taskId);
    const secondToken = await claimed(second);
    const restored = await runner(secondToken)
      .get(`/api/runs/${second}/working-copy-archive`)
      .expect(200);

    expect(granted).toMatchObject({
      url: null,
      snapshot: { name: `spotlight-${granted.id}` },
    });
    expect(restored.body).toEqual({
      id: granted.id,
      url: null,
      size: null,
      sha256: null,
      snapshot: {
        store: STORE,
        name: `spotlight-${granted.id}`,
        base: 'base-v1',
        rebase: false,
      },
    });
    const row = firstOf(
      await db
        .select()
        .from(schema.workingCopyArchive)
        .where(eq(schema.workingCopyArchive.id, granted.id)),
    );
    expect(row).toMatchObject({
      snapshotStore: STORE,
      size: null,
      sha256: null,
      workingCopyKey: `work/task-${taskId}`,
    });
    expect(row?.completedAt).not.toBeNull();
  });

  it('starts a run that starts no session from the current base of its store, when its working copy descends from another', async () => {
    const taskId = randomUUID();
    const first = await queue(taskId);
    const firstToken = await claimed(first);
    const granted = bodyOf<{ id: string }>(
      await runner(firstToken)
        .post(`/api/runs/${first}/working-copy-archive`, {
          snapshot: { base: 'base-v1' },
        })
        .expect(201),
    );
    await runner(firstToken)
      .post(`/api/runs/${first}/working-copy-archive/${granted.id}/complete`)
      .expect(204);
    await finished(first);
    await db
      .update(schema.runnerPool)
      .set({ workingCopyBase: 'base-v2' })
      .where(eq(schema.runnerPool.id, poolId));

    const fresh = await queue(taskId);
    const freshToken = await claimed(fresh);
    const onNewBase = await runner(freshToken)
      .get(`/api/runs/${fresh}/working-copy-archive`)
      .expect(200);
    const rebased = bodyOf<{ id: string }>(
      await runner(freshToken)
        .post(`/api/runs/${fresh}/working-copy-archive`, {
          snapshot: { base: 'base-v2' },
        })
        .expect(201),
    );
    await runner(freshToken)
      .post(`/api/runs/${fresh}/working-copy-archive/${rebased.id}/complete`)
      .expect(204);
    await finished(fresh);

    const carrying = await queue(taskId, { sessionId: 'session_1' });
    const carryingToken = await claimed(carrying);
    const carried = await runner(carryingToken)
      .get(`/api/runs/${carrying}/working-copy-archive`)
      .expect(200);

    expect(onNewBase.body).toMatchObject({
      id: granted.id,
      snapshot: { base: 'base-v1', rebase: true },
    });
    expect(carried.body).toMatchObject({
      id: rebased.id,
      snapshot: { base: 'base-v2', rebase: false },
    });
  });

  it('refuses a request that names both a tar and a snapshot, or neither', async () => {
    const run = await queue(randomUUID());
    const runToken = await claimed(run);

    for (const body of [{ snapshot: {}, size: 1_024 }, {}]) {
      await runner(runToken)
        .post(`/api/runs/${run}/working-copy-archive`, body)
        .expect(400);
    }
  });

  it('refuses a tar from a runner whose pool keeps a store, and a base that is not the store’s', async () => {
    const run = await queue(randomUUID());
    const runToken = await claimed(run);

    const tar = await runner(runToken).post(
      `/api/runs/${run}/working-copy-archive`,
      { size: 1_024, sha256: 'c'.repeat(64) },
    );
    const elsewhere = await runner(runToken).post(
      `/api/runs/${run}/working-copy-archive`,
      { snapshot: { base: 'base-of-another-team' } },
    );

    expect(tar.status).toBe(422);
    expect(elsewhere.status).toBe(422);
    expect(
      await db
        .select()
        .from(schema.workingCopyArchive)
        .where(eq(schema.workingCopyArchive.workspaceId, workspaceId)),
    ).toEqual([]);
  });

  it('lists the snapshots of removed archives only to hosts of the same workspace and store, until a host forgets each one', async () => {
    const other = tokenOf('s');
    await createPool({
      key: 'elsewhere',
      labels: [],
      token: other,
      workingCopies: { store: 's3://acme-e2e/other' },
    }).expect(201);
    await db.insert(schema.snapshotRemoval).values([
      {
        archiveId: 'archive_2',
        workspaceId,
        store: STORE,
        queuedAt: new Date('2026-11-20T10:00:00.000Z'),
      },
      {
        archiveId: 'archive_1',
        workspaceId,
        store: STORE,
        queuedAt: new Date('2026-11-20T09:00:00.000Z'),
      },
      {
        archiveId: 'archive_3',
        workspaceId,
        store: 's3://acme-e2e/other',
        queuedAt: new Date('2026-11-20T09:00:00.000Z'),
      },
    ]);

    const listed = await asHost('get', '/api/hosts/snapshot-removals').expect(
      200,
    );
    await asHost('delete', '/api/hosts/snapshot-removals/archive_3').expect(
      404,
    );
    await asHost('delete', '/api/hosts/snapshot-removals/archive_1').expect(
      204,
    );
    const after = await asHost('get', '/api/hosts/snapshot-removals').expect(
      200,
    );
    const elsewhere = await asHost(
      'get',
      '/api/hosts/snapshot-removals',
      other,
    ).expect(200);

    expect(listed.body).toEqual({
      store: STORE,
      removals: [
        { archiveId: 'archive_1', snapshot: 'spotlight-archive_1' },
        { archiveId: 'archive_2', snapshot: 'spotlight-archive_2' },
      ],
    });
    expect(after.body).toMatchObject({
      removals: [{ archiveId: 'archive_2' }],
    });
    expect(elsewhere.body).toEqual({
      store: 's3://acme-e2e/other',
      removals: [{ archiveId: 'archive_3', snapshot: 'spotlight-archive_3' }],
    });
  });

  it('refuses the snapshot removals to a caller that is no host', async () => {
    await asHost('get', '/api/hosts/snapshot-removals', 'not-a-token').expect(
      401,
    );
  });
});
