import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';

const ADMIN_TOKEN = `admin.${randomUUID()}`;

interface AdminWorkspace {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: string;
  readonly memberCount: number;
  readonly plan: string;
  readonly planExpiresAt: string | null;
}

interface AdminPage {
  readonly items: readonly AdminWorkspace[];
  readonly next: string | null;
}

interface Change {
  readonly resource: string;
  readonly resourceId: string;
  readonly key: string;
  readonly action: string;
  readonly by: { readonly kind: string };
  readonly details: Record<string, unknown>;
}

const at = (day: number) => new Date(Date.UTC(2026, 8, day, 9, 0, 0));

describe('admin API (e2e)', () => {
  let app: INestApplication;
  let unset: INestApplication;
  let db: DrizzleDatabase;

  const owner = randomUUID();
  const member = randomUUID();
  const outsider = randomUUID();

  const workspaces = [
    { id: randomUUID(), slug: 'admin-acme', createdAt: at(1) },
    { id: randomUUID(), slug: 'admin-globex', createdAt: at(2) },
    { id: randomUUID(), slug: 'admin-initech', createdAt: at(3) },
  ];
  const [acme, globex, initech] = workspaces;

  const admin = (token = ADMIN_TOKEN) => ({
    get: (path: string) =>
      served(app).get(path).set('Authorization', `Bearer ${token}`),
    put: (path: string, body: object) =>
      served(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) =>
      served(app).delete(path).set('Authorization', `Bearer ${token}`),
  });

  const changesOf = async (slug: string): Promise<readonly Change[]> => {
    const answer = await served(app)
      .get(`/api/workspaces/${slug}/configuration-changes`)
      .set(TEST_USER_HEADER, owner);

    expect(answer.status).toBe(200);

    return (answer.body as readonly Change[]).filter(
      (each) => each.resource === 'workspace-plan',
    );
  };

  beforeAll(async () => {
    app = await openApp(undefined, {
      env: { SPOTLIGHT_ADMIN_TOKEN: ADMIN_TOKEN },
    });
    unset = await openApp(undefined, { sharingDatabaseOf: app });
    db = app.get<DrizzleDatabase>(DRIZZLE);

    await db.insert(schema.user).values([
      { id: owner, name: 'Ada', email: `${owner}@example.com` },
      { id: member, name: 'Bea', email: `${member}@example.com` },
      { id: outsider, name: 'Cy', email: `${outsider}@example.com` },
    ]);
    await db.insert(schema.workspace).values(
      workspaces.map((each) => ({
        id: each.id,
        slug: each.slug,
        name: each.slug,
        createdAt: each.createdAt,
      })),
    );
    await db.insert(schema.workspaceMember).values([
      { workspaceId: acme.id, userId: owner, role: 'owner', createdAt: at(4) },
      {
        workspaceId: acme.id,
        userId: member,
        role: 'member',
        createdAt: at(5),
      },
      { workspaceId: globex.id, userId: owner, role: 'owner' },
      { workspaceId: initech.id, userId: outsider, role: 'owner' },
    ]);
  });

  afterAll(async () => {
    await unset?.close();
    await app?.close();
  });

  it('answers 404 on every admin route when no admin token is set', async () => {
    const http = () => served(unset);
    const calls = [
      () => http().get('/api/admin/workspaces'),
      () => http().get(`/api/admin/workspaces/${acme.id}`),
      () => http().get(`/api/admin/workspaces/${acme.id}/members`),
      () =>
        http()
          .put(`/api/admin/workspaces/${acme.id}/plan`)
          .send({ plan: 'team', expiresAt: null }),
      () => http().delete(`/api/admin/workspaces/${acme.id}/plan`),
    ];

    for (const call of calls) {
      await call().set('Authorization', `Bearer ${ADMIN_TOKEN}`).expect(404);
    }
  });

  it('refuses a call without the admin token, with a session, or with a workspace token', async () => {
    const issued = await served(app)
      .post(`/api/v1/resources/workspaces/${acme.id}/tokens`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'ci', scopes: ['read', 'plan', 'configure'] });

    expect(issued.status).toBe(201);

    const workspaceToken = issued.headers['spotlight-workspace-token'];

    await served(app).get('/api/admin/workspaces').expect(401);
    await served(app)
      .get('/api/admin/workspaces')
      .set(TEST_USER_HEADER, owner)
      .expect(401);
    await admin(workspaceToken).get('/api/admin/workspaces').expect(401);
    await admin('wrong-admin-token-0123456789abcdefghij')
      .get('/api/admin/workspaces')
      .expect(401);
  });

  it('never takes the admin token on a route that is not an admin route', async () => {
    await admin().get('/api/workspaces').expect(401);
    await admin().get(`/api/v1/resources/workspaces/${acme.id}`).expect(401);
  });

  it('lists every workspace oldest first, a page at a time', async () => {
    const first = await admin().get('/api/admin/workspaces?limit=2');

    expect(first.status).toBe(200);

    const page = first.body as AdminPage;

    expect(page.items.map((each) => each.slug)).toEqual([
      'admin-acme',
      'admin-globex',
    ]);
    expect(page.items[0]).toEqual({
      id: acme.id,
      slug: 'admin-acme',
      name: 'admin-acme',
      createdAt: at(1).toISOString(),
      memberCount: 2,
      plan: 'free',
      planExpiresAt: null,
    });
    expect(page.next).not.toBeNull();

    const second = (
      await admin()
        .get(`/api/admin/workspaces?limit=2&after=${page.next}`)
        .expect(200)
    ).body as AdminPage;

    expect(second.items.map((each) => each.slug)).toEqual(['admin-initech']);
    expect(second.next).toBeNull();
  });

  it('lists only the workspaces created after a time', async () => {
    const answer = await admin()
      .get(`/api/admin/workspaces?createdAfter=${at(1).toISOString()}`)
      .expect(200);

    expect((answer.body as AdminPage).items.map((each) => each.slug)).toEqual([
      'admin-globex',
      'admin-initech',
    ]);
  });

  it('refuses a cursor it did not give, a bad limit and a bad time', async () => {
    await admin().get('/api/admin/workspaces?after=nonsense').expect(422);
    await admin().get('/api/admin/workspaces?limit=0').expect(400);
    await admin().get('/api/admin/workspaces?createdAfter=soon').expect(400);
  });

  it('reads one workspace, and finds none for an id that names none', async () => {
    const answer = await admin()
      .get(`/api/admin/workspaces/${globex.id}`)
      .expect(200);

    expect(answer.body).toMatchObject({
      id: globex.id,
      memberCount: 1,
      plan: 'free',
    });
    await admin().get(`/api/admin/workspaces/${randomUUID()}`).expect(404);
  });

  it('lists the members of a workspace with their roles', async () => {
    const answer = await admin()
      .get(`/api/admin/workspaces/${acme.id}/members`)
      .expect(200);

    expect(answer.body).toEqual([
      {
        id: owner,
        email: `${owner}@example.com`,
        name: 'Ada',
        role: 'owner',
        joinedAt: at(4).toISOString(),
      },
      {
        id: member,
        email: `${member}@example.com`,
        name: 'Bea',
        role: 'member',
        joinedAt: at(5).toISOString(),
      },
    ]);
    await admin()
      .get(`/api/admin/workspaces/${randomUUID()}/members`)
      .expect(404);
  });

  it('sets, changes and removes the plan of a workspace, and records each change as made by Spotlight', async () => {
    const plan = `/api/admin/workspaces/${globex.id}/plan`;
    const expiresAt = '2027-01-01T00:00:00.000Z';

    expect(
      (await admin().put(plan, { plan: 'team', expiresAt }).expect(200)).body,
    ).toEqual({ plan: 'team', expiresAt });
    expect(
      (await admin().get(`/api/admin/workspaces/${globex.id}`)).body,
    ).toMatchObject({ plan: 'team', planExpiresAt: expiresAt });

    await admin().put(plan, { plan: 'team', expiresAt }).expect(200);
    await admin()
      .put(plan, { plan: 'enterprise', expiresAt: null })
      .expect(200);
    expect(
      (await admin().get(`/api/admin/workspaces/${globex.id}`)).body,
    ).toMatchObject({ plan: 'enterprise', planExpiresAt: null });

    await admin().delete(plan).expect(204);
    await admin().delete(plan).expect(204);
    expect(
      (await admin().get(`/api/admin/workspaces/${globex.id}`)).body,
    ).toMatchObject({ plan: 'free', planExpiresAt: null });
    expect(
      await db
        .select()
        .from(schema.workspacePlan)
        .where(eq(schema.workspacePlan.workspaceId, globex.id)),
    ).toEqual([]);

    expect(
      (await changesOf('admin-globex')).map((each) => [
        each.action,
        each.by.kind,
        each.resourceId,
        each.key,
        each.details,
      ]),
    ).toEqual([
      ['deleted', 'spotlight', globex.id, 'plan', {}],
      [
        'updated',
        'spotlight',
        globex.id,
        'plan',
        { plan: 'enterprise', expiresAt: null },
      ],
      ['created', 'spotlight', globex.id, 'plan', { plan: 'team', expiresAt }],
    ]);
  });

  it('lists the plan of each workspace that has one', async () => {
    await admin()
      .put(`/api/admin/workspaces/${initech.id}/plan`, { plan: 'team' })
      .expect(200);

    const page = (await admin().get('/api/admin/workspaces').expect(200))
      .body as AdminPage;

    expect(
      page.items.map((each) => [each.slug, each.plan, each.planExpiresAt]),
    ).toEqual([
      ['admin-acme', 'free', null],
      ['admin-globex', 'free', null],
      ['admin-initech', 'team', null],
    ]);
  });

  it('refuses a plan that does not exist, a missing plan, a bad end and a workspace that does not exist, and stores nothing for the free plan', async () => {
    const plan = `/api/admin/workspaces/${acme.id}/plan`;

    await admin().put(plan, { plan: 'gold', expiresAt: null }).expect(422);
    await admin().put(plan, { plan: 'team', expiresAt: 'soon' }).expect(400);
    await admin().put(plan, { plan: 'team', expiresAt: 7 }).expect(400);
    await admin().put(plan, { expiresAt: null }).expect(400);
    await admin()
      .put(plan, { plan: 'free', expiresAt: '2027-01-01T00:00:00Z' })
      .expect(200);
    await admin()
      .put(`/api/admin/workspaces/${randomUUID()}/plan`, { plan: 'team' })
      .expect(404);
    await admin()
      .delete(`/api/admin/workspaces/${randomUUID()}/plan`)
      .expect(404);
    expect(await changesOf('admin-acme')).toEqual([]);
  });

  it('removes the plan of a workspace that is deleted', async () => {
    const planOf = () =>
      db
        .select()
        .from(schema.workspacePlan)
        .where(eq(schema.workspacePlan.workspaceId, initech.id));

    expect(await planOf()).toHaveLength(1);

    await served(app)
      .delete(`/api/v1/resources/workspaces/${initech.id}`)
      .set(TEST_USER_HEADER, outsider)
      .set('If-Match', '"0"')
      .expect(204);

    expect(
      await eventually(async () => ((await planOf()).length === 0 ? [] : null)),
    ).toEqual([]);
    await admin().get(`/api/admin/workspaces/${initech.id}`).expect(404);
  });
});
