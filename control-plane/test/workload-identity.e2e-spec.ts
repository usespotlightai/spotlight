import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  openWorkloadIssuer,
  type WorkloadIssuer,
} from '@platform/workload/workload-issuer.fake-spec';
import { eq } from 'drizzle-orm';
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
import { awaitingCheck } from './support/change-stacks';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const SUBJECT = 'system:serviceaccount:spotlight:runner';

const HOST = 'pod-a-host-000001';

describe('a host claiming through a runner trust, as a platform workload with no token (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let platform: WorkloadIssuer;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const trusted = async (labels: string[] = ['vpc-internal']) => {
    const made = await http()
      .post(`/api/resources/workspaces/${held}/runner-trusts`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({
        key: 'production',
        issuer: platform.issuer,
        subject: SUBJECT,
        labels,
      });

    expect(made.status).toBe(201);

    return made.body as { id: string; version: number };
  };

  const workload = () => platform.issue({ sub: SUBJECT, aud: 'spotlight' });

  const claim = (trust: string, token: string) =>
    http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${token}`)
      .set('Spotlight-Trust', trust)
      .send({
        host: HOST,
        image: 'ghcr.io/acme/runner:main',
      });

  const present = (trust: string, token: string, running: string[] = []) =>
    http()
      .put(`/api/hosts/${HOST}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Spotlight-Trust', trust)
      .send({
        name: 'pod-a',
        release: '0.1.0',
        executor: 'docker',
        capacity: 2,
        running,
        images: [
          {
            image: 'ghcr.io/acme/runner:main',
            usual: true,
            harnesses: [{ id: 'dev', models: [] }],
          },
        ],
      });

  const hostRow = async () => {
    const [row] = await db
      .select()
      .from(schema.runnerHost)
      .where(eq(schema.runnerHost.id, HOST));

    return row ?? null;
  };

  const queue = async (placement: string[]) => {
    const id = randomUUID();

    await db.insert(schema.run).values({
      id,
      workspaceId: held,
      harness: 'dev',
      state: 'queued',
      priority: 1000,
      placement: placement.length > 0 ? [placement] : [],
      spec: {
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 0 },
        continuity: { key: 'task:station' },
      },
    });

    return id;
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
    platform = await openWorkloadIssuer();
  });

  afterAll(async () => {
    await platform.close();
    await app.close();
  });

  beforeEach(async () => {
    held = `workload-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, `person:${owner}`));
    await forgetRunnersOf(db, held);
    await unseat();
  });

  it('claims work placed on its trust’s label with the token its platform issued, through a one-run runner of that trust', async () => {
    const trust = await trusted();
    const placed = await queue(['vpc-internal']);
    await present(trust.id, await workload()).expect(200);

    const claimed = await claim(trust.id, await workload());

    expect(claimed.status).toBe(200);
    expect(claimed.body).toEqual({
      runnerId: expect.any(String),
      token: expect.any(String),
      egressToken: expect.any(String),
      work: expect.objectContaining({ kind: 'run', run: expect.anything() }),
    });
    expect(claimed.body.work.run.id).toBe(placed);

    const [started] = await db
      .select({
        trustId: schema.runner.trustId,
        poolId: schema.runner.poolId,
        hostId: schema.runner.hostId,
        workId: schema.runner.workId,
      })
      .from(schema.runner)
      .where(eq(schema.runner.id, claimed.body.runnerId));

    expect(started).toEqual({
      trustId: trust.id,
      poolId: null,
      hostId: HOST,
      workId: placed,
    });

    await http()
      .post(`/api/runs/${placed}/lease`)
      .set('Authorization', `Bearer ${claimed.body.token}`)
      .expect(201);
  });

  it('leaves work placed on a label its trust does not carry', async () => {
    const trust = await trusted();
    const placed = await queue(['gpu']);
    await present(trust.id, await workload()).expect(200);

    await claim(trust.id, await workload()).expect(204);

    const [still] = await db
      .select({ state: schema.run.state })
      .from(schema.run)
      .where(eq(schema.run.id, placed));

    expect(still?.state).toBe('queued');
  }, 30_000);

  it('hands over a check placed on its trust’s label', async () => {
    const trust = await trusted();
    const stackId = await awaitingCheck(db, held, [['vpc-internal']]);
    await present(trust.id, await workload()).expect(200);

    const claimed = await claim(trust.id, await workload());

    expect(claimed.status).toBe(200);
    expect(claimed.body.work).toMatchObject({
      kind: 'check',
      check: { stackId },
    });
  });

  it('refuses a token for another workload, another audience, or signed by anyone else', async () => {
    const trust = await trusted();

    for (const token of [
      await platform.issue({
        sub: 'system:serviceaccount:x:y',
        aud: 'spotlight',
      }),
      await platform.issue({ sub: SUBJECT, aud: 'vault' }),
      await platform.forge({ sub: SUBJECT, aud: 'spotlight' }),
    ]) {
      expect((await claim(trust.id, token)).status).toBe(401);
      expect((await present(trust.id, token)).status).toBe(401);
    }

    expect((await claim(randomUUID(), await workload())).status).toBe(401);
    expect(
      (
        await http()
          .get('/api/hosts/requirements')
          .set('Authorization', `Bearer ${await workload()}`)
          .set('Spotlight-Trust', randomUUID())
      ).status,
    ).toBe(401);
  });

  it('refuses anyone through a trust once it is withdrawn, and forgets the hosts that came in by it', async () => {
    const trust = await trusted();
    await queue(['vpc-internal']);
    await present(trust.id, await workload()).expect(200);

    await http()
      .delete(`/api/resources/runner-trusts/${trust.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${trust.version}"`)
      .expect(204);

    expect((await claim(trust.id, await workload())).status).toBe(401);
    expect((await present(trust.id, await workload())).status).toBe(401);
    await eventually(async () => (await hostRow()) === null);
  });

  it('refuses anyone into a workspace that has closed', async () => {
    const trust = await trusted();

    await unseat();

    expect((await claim(trust.id, await workload())).status).toBe(401);
  });

  it('lets a host through a trust say it is here, what it holds and what it runs, and ask what it should serve', async () => {
    const trust = await trusted();

    const answered = await present(trust.id, await workload(), ['run-1']);

    expect(answered.status).toBe(200);
    expect(answered.body).toEqual({ workspace: expect.any(String) });

    expect(await hostRow()).toMatchObject({
      workspaceId: answered.body.workspace,
      trustId: trust.id,
      poolId: null,
      name: 'pod-a',
      release: '0.1.0',
      executor: 'docker',
      capacity: 2,
      running: ['run-1'],
    });

    await http()
      .get('/api/hosts/requirements')
      .set('Authorization', `Bearer ${await workload()}`)
      .set('Spotlight-Trust', trust.id)
      .expect(200);
  });
});
