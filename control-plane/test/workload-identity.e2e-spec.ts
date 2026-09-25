import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  openWorkloadIssuer,
  type WorkloadIssuer,
} from '@runners/infrastructure/workload/workload-issuer.fake-spec';
import { RUNNER_TOKEN_HEADER } from '@runners/presentation/http/controllers/runner-resource.controller';
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
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const SUBJECT = 'system:serviceaccount:spotlight:runner';

describe('a runner enrolling as a platform workload, with no token (e2e)', () => {
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

  const exchange = async (trust: string, token: string, name = 'pod-a') =>
    http().post('/api/runners/exchange').send({ trust, token, name });

  const register = (token: string) =>
    http()
      .post('/api/runners/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ harnesses: [{ id: 'dev' }] });

  const claim = (token: string) =>
    http().post('/api/runners/claim').set('Authorization', `Bearer ${token}`);

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
        continuity: { key: 'task:station', keep: true },
      },
    });

    return id;
  };

  const withToken = async () => {
    const made = await http()
      .post(`/api/resources/workspaces/${held}/runners`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'laptop' });

    return made.headers[RUNNER_TOKEN_HEADER.toLowerCase()] as string;
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

  it('enrols with the token its platform issued it, and claims work placed on its trust’s label', async () => {
    const trust = await trusted();
    const exchanged = await exchange(
      trust.id,
      await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
    );

    expect(exchanged.status).toBe(200);
    expect(exchanged.body).toEqual({
      runnerId: expect.any(String),
      token: expect.any(String),
    });

    await register(exchanged.body.token).expect(201);

    const placed = await queue(['vpc-internal']);
    const claimed = await claim(exchanged.body.token);

    expect(claimed.status).toBe(201);
    expect(claimed.body).toMatchObject({ kind: 'run', run: { id: placed } });

    const [enrolled] = await db
      .select({ trustId: schema.runner.trustId, name: schema.runner.name })
      .from(schema.runner)
      .where(eq(schema.runner.id, exchanged.body.runnerId));

    expect(enrolled).toEqual({ trustId: trust.id, name: 'pod-a' });
  });

  it('leaves work placed on a label to the runners that carry it', async () => {
    await trusted();
    const token = await withToken();

    await register(token).expect(201);

    const placed = await queue(['vpc-internal']);
    const open = await queue([]);
    const claimed = await claim(token);

    expect(claimed.body).toMatchObject({ kind: 'run', run: { id: open } });

    const [still] = await db
      .select({ state: schema.run.state })
      .from(schema.run)
      .where(eq(schema.run.id, placed));

    expect(still?.state).toBe('queued');
  });

  it('hands a check placed on its trust’s label to a runner enrolled through it', async () => {
    const trust = await trusted();
    const exchanged = await exchange(
      trust.id,
      await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
    );

    await register(exchanged.body.token).expect(201);

    const stackId = await awaitingCheck(db, held, [['vpc-internal']]);
    const claimed = await claim(exchanged.body.token);

    expect(claimed.body).toMatchObject({ kind: 'check', check: { stackId } });
  });

  it('issues the same runner a new token when it exchanges again under its name', async () => {
    const trust = await trusted();
    const first = await exchange(
      trust.id,
      await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
    );
    const second = await exchange(
      trust.id,
      await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
    );

    expect(second.body.runnerId).toBe(first.body.runnerId);
    await register(first.body.token).expect(401);
    await register(second.body.token).expect(201);
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
      expect((await exchange(trust.id, token)).status).toBe(401);
    }

    expect(
      (
        await exchange(
          randomUUID(),
          await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
        )
      ).status,
    ).toBe(401);
  });

  it('refuses to enrol anyone into a workspace that has closed', async () => {
    const trust = await trusted();

    await unseat();

    expect(
      (
        await exchange(
          trust.id,
          await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
        )
      ).status,
    ).toBe(401);
  });

  it('stops every runner under a trust claiming anything once the trust is deleted', async () => {
    const trust = await trusted();
    const exchanged = await exchange(
      trust.id,
      await platform.issue({ sub: SUBJECT, aud: 'spotlight' }),
    );

    await register(exchanged.body.token).expect(201);

    const placed = await queue(['vpc-internal']);

    await claim(exchanged.body.token).expect(201);

    await http()
      .delete(`/api/resources/runner-trusts/${trust.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${trust.version}"`)
      .expect(204);

    await claim(exchanged.body.token).expect(401);

    await app.get(EventDelivery).drain();

    const [runner] = await db
      .select({ revokedAt: schema.runner.revokedAt })
      .from(schema.runner)
      .where(eq(schema.runner.id, exchanged.body.runnerId));
    const [run] = await db
      .select({ state: schema.run.state, claimedBy: schema.run.claimedBy })
      .from(schema.run)
      .where(eq(schema.run.id, placed));

    expect(runner?.revokedAt).not.toBeNull();
    expect(run).toEqual({ state: 'queued', claimedBy: null });
  });
});
