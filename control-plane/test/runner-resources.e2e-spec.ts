import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
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
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const PROVIDER = 'terraform-provider/0.1.0';

const WORKSPACE_TOKEN_HEADER = 'spotlight-workspace-token';

const ISSUER = 'https://oidc.example.com/cluster';
const SUBJECT = 'system:serviceaccount:spotlight:runner';

const seated =
  (
    kind: 'runner-trusts' | 'runner-pools' | 'workspace-runners' | 'egresses',
    bodies: Pick<
      ResourceFixture,
      'valid' | 'changed' | 'changedAgain' | 'invalid'
    > & { address?: string },
  ) =>
  async (app: INestApplication): Promise<ResourceFixture> => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const held = `${kind}-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);

    return {
      admin: seat.owner,
      viewer: seat.member,
      collection: `/api/resources/workspaces/${held}/${kind}`,
      item: (id) => `/api/resources/${kind}/${id}`,
      importing: (address) =>
        `/api/resources/workspaces/${held}/${kind}/import?address=${encodeURIComponent(address)}`,
      listing: (workspaceId) =>
        `/api/resources/workspaces/${workspaceId}/${kind}`,
      workspaceOf: () => held,
      address: bodies.address ?? held,
      ...bodies,
      close: async () => {
        await db
          .delete(schema.idempotentCreate)
          .where(
            inArray(schema.idempotentCreate.scope, [
              `person:${seat.owner}`,
              `person:${seat.member}`,
            ]),
          );
        await forgetRunnersOf(db, held);
        await seat.unseat();
      },
    };
  };

conformsAsResource({
  kind: 'runner-trust',
  open: seated('runner-trusts', {
    address: 'production',
    valid: { key: 'production', issuer: ISSUER, subject: SUBJECT },
    changed: {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
      labels: ['vpc-internal'],
    },
    changedAgain: {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
      audience: 'sts.amazonaws.com',
    },
    invalid: {
      body: { key: 'Production', issuer: ISSUER, subject: SUBJECT },
      path: 'key',
    },
  }),
});

conformsAsResource({
  kind: 'runner-pool',
  open: seated('runner-pools', {
    address: 'ephemeral',
    valid: { key: 'ephemeral', labels: ['linux'] },
    changed: { key: 'ephemeral', labels: ['gpu'] },
    changedAgain: { key: 'ephemeral', labels: ['gpu'], maxRuns: 2 },
    invalid: { body: { key: 'Ephemeral' }, path: 'key' },
  }),
});

conformsAsResource({
  kind: 'egress',
  open: seated('egresses', {
    address: 'shared',
    valid: { key: 'shared', url: 'https://egress.example.com' },
    changed: { key: 'shared', url: 'https://egress-2.example.com' },
    changedAgain: { key: 'shared', url: 'https://egress-3.example.com' },
    invalid: {
      body: { key: 'Shared', url: 'https://egress.example.com' },
      path: 'key',
    },
  }),
});

conformsAsResource({
  kind: 'workspace-runners',
  open: seated('workspace-runners', {
    valid: { trusts: ['production'] },
    changed: { trusts: ['staging'] },
    changedAgain: { trusts: [], pools: ['ephemeral'] },
    invalid: { body: { trusts: [''] }, path: 'trusts[0]' },
  }),
});

describe('runner trusts, pools and what the workspace declares of them (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const asOwner = (
    kind: 'runner-trusts' | 'runner-pools' | 'workspace-runners',
    body: object,
  ) =>
    http()
      .post(`/api/resources/workspaces/${held}/${kind}`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    held = `fleet-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    const issued = await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, held))
      .returning({ id: schema.workspaceToken.id });

    await db
      .delete(schema.idempotentCreate)
      .where(
        inArray(schema.idempotentCreate.scope, [
          `person:${owner}`,
          ...issued.map((each) => `token:${each.id}`),
        ]),
      );
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    await forgetRunnersOf(db, held);
    await unseat();
  });

  const tokenWith = async (scopes: readonly string[]) => {
    const issued = await http()
      .post(`/api/resources/workspaces/${held}/tokens`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: scopes.join('-'), scopes });

    expect(issued.status).toBe(201);

    return issued.headers[WORKSPACE_TOKEN_HEADER] as string;
  };

  const as = (token: string) => ({
    get: (path: string) =>
      http()
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', PROVIDER),
    post: (path: string, body: object) =>
      http()
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', PROVIDER)
        .set('Idempotency-Key', randomUUID())
        .send(body),
    put: (path: string, version: number, body: object) =>
      http()
        .put(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', PROVIDER)
        .set('If-Match', `"${version}"`)
        .send(body),
    delete: (path: string, version: number) =>
      http()
        .delete(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', PROVIDER)
        .set('If-Match', `"${version}"`),
  });

  it('lets a configure token with the runners scope manage trusts, pools and the declaration, as Terraform would', async () => {
    const terraform = as(await tokenWith(['configure', 'runners']));
    const trust = await terraform.post(
      `/api/resources/workspaces/${held}/runner-trusts`,
      { key: 'production', issuer: ISSUER, subject: SUBJECT },
    );
    const pool = await terraform.post(
      `/api/resources/workspaces/${held}/runner-pools`,
      { key: 'ephemeral' },
    );
    const declared = await terraform.post(
      `/api/resources/workspaces/${held}/workspace-runners`,
      { trusts: ['production'], pools: ['ephemeral'] },
    );

    expect([trust.status, pool.status, declared.status]).toEqual([
      201, 201, 201,
    ]);
    expect(declared.body.warnings).toEqual([]);
    expect(
      (
        await terraform.put(
          `/api/resources/runner-pools/${pool.body.id}`,
          pool.body.version,
          { key: 'ephemeral', labels: ['gpu'] },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await terraform.delete(
          `/api/resources/runner-trusts/${trust.body.id}`,
          trust.body.version,
        )
      ).status,
    ).toBe(204);
  });

  it('answers 403 to a configure token without the runners scope, on every trust, pool and declaration write', async () => {
    const trust = await asOwner('runner-trusts', {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
    });
    const pool = await asOwner('runner-pools', { key: 'ephemeral' });
    const declared = await asOwner('workspace-runners', {
      trusts: ['production'],
    });
    const configure = as(await tokenWith(['configure']));

    const answered = [
      await configure.post(`/api/resources/workspaces/${held}/runner-trusts`, {
        key: 'staging',
        issuer: ISSUER,
        subject: SUBJECT,
      }),
      await configure.put(
        `/api/resources/runner-trusts/${trust.body.id}`,
        trust.body.version,
        {
          key: 'production',
          issuer: ISSUER,
          subject: SUBJECT,
          labels: ['gpu'],
        },
      ),
      await configure.delete(
        `/api/resources/runner-trusts/${trust.body.id}`,
        trust.body.version,
      ),
      await configure.post(`/api/resources/workspaces/${held}/runner-pools`, {
        key: 'sandboxes',
      }),
      await configure.put(
        `/api/resources/runner-pools/${pool.body.id}`,
        pool.body.version,
        { key: 'ephemeral', labels: ['gpu'] },
      ),
      await configure.delete(
        `/api/resources/runner-pools/${pool.body.id}`,
        pool.body.version,
      ),
      await configure.put(
        `/api/resources/workspace-runners/${declared.body.id}`,
        declared.body.version,
        { trusts: [] },
      ),
      await configure.delete(
        `/api/resources/workspace-runners/${declared.body.id}`,
        declared.body.version,
      ),
    ];

    expect(answered.map((each) => each.status)).toEqual(
      Array(answered.length).fill(403),
    );
    expect(
      answered.map((each) => [
        each.body.type,
        each.body.title,
        each.body.permission,
      ]),
    ).toEqual(
      [
        ...Array(3).fill('Not allowed to change the runner-trust'),
        ...Array(3).fill('Not allowed to change the runner-pool'),
        ...Array(2).fill('Not allowed to change the workspace-runners'),
      ].map((title) => [
        'urn:spotlight:problem:forbidden',
        title,
        'manage-runners',
      ]),
    );
    expect(
      (await configure.get(`/api/resources/runner-trusts/${trust.body.id}`))
        .status,
    ).toBe(200);
  });

  it('refuses a token that would manage runners without a rung of the ladder', async () => {
    const refused = await http()
      .post(`/api/resources/workspaces/${held}/tokens`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'runners', scopes: ['runners'] });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({ path: 'scopes' }),
    ]);
  });

  it('lets a read token read trusts and pools, but answers 403 to anything it would change', async () => {
    const trust = await asOwner('runner-trusts', {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
    });
    const pool = await asOwner('runner-pools', { key: 'ephemeral' });
    const reader = as(await tokenWith(['read']));

    expect(
      (await reader.get(`/api/resources/runner-trusts/${trust.body.id}`))
        .status,
    ).toBe(200);
    expect(
      (await reader.get(`/api/resources/runner-pools/${pool.body.id}`)).status,
    ).toBe(200);
    expect(
      (
        await reader.post(`/api/resources/workspaces/${held}/runner-pools`, {
          key: 'sandboxes',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await reader.put(
          `/api/resources/runner-pools/${pool.body.id}`,
          pool.body.version,
          { key: 'ephemeral', labels: ['gpu'] },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await reader.post(`/api/resources/workspaces/${held}/runner-trusts`, {
          key: 'staging',
          issuer: ISSUER,
          subject: SUBJECT,
        })
      ).status,
    ).toBe(403);
  });

  it('audits who changed trusts, pools and the declaration', async () => {
    const terraform = as(await tokenWith(['configure', 'runners']));
    const trust = await asOwner('runner-trusts', {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
    });

    await terraform
      .put(
        `/api/resources/runner-trusts/${trust.body.id}`,
        trust.body.version,
        {
          key: 'production',
          issuer: ISSUER,
          subject: SUBJECT,
          labels: ['gpu'],
        },
      )
      .expect(200);
    await terraform
      .post(`/api/resources/workspaces/${held}/runner-pools`, {
        key: 'ephemeral',
      })
      .expect(201);
    await terraform
      .post(`/api/resources/workspaces/${held}/workspace-runners`, {
        trusts: ['production'],
      })
      .expect(201);

    const changes = (
      await http()
        .get(`/api/workspaces/${held}/configuration-changes`)
        .set(TEST_USER_HEADER, owner)
    ).body as {
      resource: string;
      key: string;
      action: string;
      by: { kind: string };
    }[];

    expect(
      changes
        .filter((each) =>
          ['runner-trust', 'runner-pool', 'workspace-runners'].includes(
            each.resource,
          ),
        )
        .map((each) => [each.resource, each.key, each.action, each.by.kind]),
    ).toEqual([
      ['workspace-runners', 'runners', 'created', 'token'],
      ['runner-pool', 'ephemeral', 'created', 'token'],
      ['runner-trust', 'production', 'updated', 'token'],
      ['runner-trust', 'production', 'created', 'person'],
    ]);
  });

  it('keeps the workspace from closing while it holds trusts, pools or a declaration', async () => {
    await asOwner('runner-trusts', {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
    }).expect(201);
    await asOwner('runner-pools', { key: 'ephemeral' }).expect(201);
    await asOwner('workspace-runners', { trusts: ['production'] }).expect(201);

    const workspace = await http()
      .get(`/api/resources/workspaces/${held}`)
      .set(TEST_USER_HEADER, owner);
    const refused = await http()
      .delete(`/api/resources/workspaces/${held}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${workspace.body.version}"`);

    expect(refused.status).toBe(409);
    expect(refused.body.detail).toEqual(
      expect.stringContaining('runner trust production'),
    );
    expect(refused.body.detail).toEqual(
      expect.stringContaining('runner pool ephemeral'),
    );
    expect(refused.body.detail).toEqual(
      expect.stringContaining('workspace runners'),
    );
  });

  it('warns of every trust or pool the declaration names that the workspace does not have', async () => {
    await asOwner('runner-trusts', {
      key: 'production',
      issuer: ISSUER,
      subject: SUBJECT,
    }).expect(201);
    await asOwner('runner-pools', { key: 'ephemeral' }).expect(201);

    const declared = await asOwner('workspace-runners', {
      trusts: ['production', 'staging'],
      pools: ['sandboxes', 'ephemeral'],
    });

    expect(declared.status).toBe(201);
    expect(declared.body).toMatchObject({
      trusts: ['production', 'staging'],
      pools: ['sandboxes', 'ephemeral'],
    });
    expect(declared.body).not.toHaveProperty('runners');
    expect(declared.body).not.toHaveProperty('drift');
    expect(declared.body.warnings).toEqual([
      expect.objectContaining({ path: 'trusts[1]', severity: 'warning' }),
      expect.objectContaining({ path: 'pools[0]', severity: 'warning' }),
    ]);
  });
});
