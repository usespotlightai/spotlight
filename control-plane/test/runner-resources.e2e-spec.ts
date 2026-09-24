import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RUNNER_TOKEN_HEADER } from '@runners/presentation/http/controllers/runner-resource.controller';
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
    kind: 'runners' | 'runner-trusts' | 'workspace-runners',
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
  kind: 'runner',
  open: seated('runners', {
    address: 'build-1',
    valid: { name: 'build-1' },
    changed: { name: 'build-1', labels: ['vpc-internal'] },
    changedAgain: { name: 'build-1', labels: ['gpu'] },
    invalid: { body: { name: '' }, path: 'name' },
  }),
});

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
  kind: 'workspace-runners',
  open: seated('workspace-runners', {
    valid: { runners: ['build-1'] },
    changed: { runners: ['build-2'] },
    changedAgain: { runners: [], trusts: ['production'] },
    invalid: { body: { runners: [''] }, path: 'runners[0]' },
  }),
});

describe('runners and what the workspace declares of them (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  const enrol = (body: object, key = randomUUID()) =>
    http()
      .post(`/api/resources/workspaces/${held}/runners`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', key)
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

  it('lets a configure token with the runners scope manage runners, trusts and the declaration, as Terraform would', async () => {
    const terraform = as(await tokenWith(['configure', 'runners']));
    const trust = await terraform.post(
      `/api/resources/workspaces/${held}/runner-trusts`,
      { key: 'production', issuer: ISSUER, subject: SUBJECT },
    );
    const runner = await terraform.post(
      `/api/resources/workspaces/${held}/runners`,
      { name: 'build-1' },
    );
    const declared = await terraform.post(
      `/api/resources/workspaces/${held}/workspace-runners`,
      { runners: ['build-1'], trusts: ['production'] },
    );

    expect([trust.status, runner.status, declared.status]).toEqual([
      201, 201, 201,
    ]);
    expect(runner.headers[RUNNER_TOKEN_HEADER.toLowerCase()]).toEqual(
      expect.any(String),
    );
    expect(
      (
        await terraform.put(
          `/api/resources/runners/${runner.body.id}`,
          runner.body.version,
          { name: 'build-1', labels: ['gpu'] },
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

  it('answers 403 to a configure token without the runners scope, on every runner, trust and declaration write', async () => {
    const trust = await http()
      .post(`/api/resources/workspaces/${held}/runner-trusts`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'production', issuer: ISSUER, subject: SUBJECT });
    const runner = await enrol({ name: 'build-1' });
    const declared = await http()
      .post(`/api/resources/workspaces/${held}/workspace-runners`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ runners: ['build-1'] });
    const configure = as(await tokenWith(['configure']));

    const answered = [
      await configure.post(`/api/resources/workspaces/${held}/runners`, {
        name: 'build-2',
      }),
      await configure.put(
        `/api/resources/runners/${runner.body.id}`,
        runner.body.version,
        { name: 'build-1', token: randomUUID().replaceAll('-', '') },
      ),
      await configure.delete(
        `/api/resources/runners/${runner.body.id}`,
        runner.body.version,
      ),
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
      await configure.put(
        `/api/resources/workspace-runners/${declared.body.id}`,
        declared.body.version,
        { runners: [] },
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
        ...Array(3).fill('Not allowed to change the runner'),
        ...Array(3).fill('Not allowed to change the runner-trust'),
        ...Array(2).fill('Not allowed to change the workspace-runners'),
      ].map((title) => [
        'urn:spotlight:problem:forbidden',
        title,
        'manage-runners',
      ]),
    );
    expect(
      (await configure.get(`/api/resources/runners/${runner.body.id}`)).status,
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

  it('lets a read token read runners, but answers 403 to anything it would change', async () => {
    const made = await enrol({ name: 'build-1' });
    const reader = as(await tokenWith(['read']));

    expect(
      (await reader.get(`/api/resources/runners/${made.body.id}`)).status,
    ).toBe(200);
    expect(
      (
        await reader.post(`/api/resources/workspaces/${held}/runners`, {
          name: 'build-2',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await reader.put(
          `/api/resources/runners/${made.body.id}`,
          made.body.version,
          { name: 'build-1', labels: ['gpu'] },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await reader.post(`/api/resources/workspaces/${held}/runner-trusts`, {
          key: 'production',
          issuer: ISSUER,
          subject: SUBJECT,
        })
      ).status,
    ).toBe(403);
  });

  it('audits who changed runners, trusts and the declaration, token rotations included', async () => {
    const terraform = as(await tokenWith(['configure', 'runners']));
    const made = await enrol({ name: 'build-1' });

    await terraform
      .put(`/api/resources/runners/${made.body.id}`, made.body.version, {
        name: 'build-1',
        token: randomUUID().replaceAll('-', ''),
      })
      .expect(200);
    await terraform
      .post(`/api/resources/workspaces/${held}/runner-trusts`, {
        key: 'production',
        issuer: ISSUER,
        subject: SUBJECT,
      })
      .expect(201);
    await terraform
      .post(`/api/resources/workspaces/${held}/workspace-runners`, {
        runners: ['build-1'],
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
      client: string;
      details: object;
    }[];

    expect(
      changes
        .filter((each) =>
          ['runner', 'runner-trust', 'workspace-runners'].includes(
            each.resource,
          ),
        )
        .map((each) => [
          each.resource,
          each.key,
          each.action,
          each.by.kind,
          each.details,
        ]),
    ).toEqual([
      ['workspace-runners', 'runners', 'created', 'token', {}],
      ['runner-trust', 'production', 'created', 'token', {}],
      ['runner', 'build-1', 'updated', 'token', { rekeyed: true }],
      ['runner', 'build-1', 'created', 'person', {}],
    ]);
  });

  it('keeps the workspace from closing while it holds runners, trusts or a declaration', async () => {
    await enrol({ name: 'build-1' });
    await http()
      .post(`/api/resources/workspaces/${held}/runner-trusts`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'production', issuer: ISSUER, subject: SUBJECT })
      .expect(201);
    await http()
      .post(`/api/resources/workspaces/${held}/workspace-runners`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ runners: ['build-1'] })
      .expect(201);

    const workspace = await http()
      .get(`/api/resources/workspaces/${held}`)
      .set(TEST_USER_HEADER, owner);
    const refused = await http()
      .delete(`/api/resources/workspaces/${held}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${workspace.body.version}"`);

    expect(refused.status).toBe(409);
    expect(refused.body.detail).toEqual(
      expect.stringContaining('runner build-1'),
    );
    expect(refused.body.detail).toEqual(
      expect.stringContaining('runner trust production'),
    );
    expect(refused.body.detail).toEqual(
      expect.stringContaining('workspace runners'),
    );
  });

  it('answers the token it issued once, keeps only its hash, and the runner calls with it', async () => {
    const key = randomUUID();
    const made = await enrol({ name: 'build-1' }, key);
    const token = made.headers[RUNNER_TOKEN_HEADER.toLowerCase()];
    const [kept] = await db
      .select({ tokenHash: schema.runner.tokenHash })
      .from(schema.runner)
      .where(eq(schema.runner.id, made.body.id));

    expect(token).toEqual(expect.any(String));
    expect(JSON.stringify(made.body)).not.toContain(token);
    expect(kept?.tokenHash).not.toBe(token);
    expect(
      (await enrol({ name: 'build-1' }, key)).headers[
        RUNNER_TOKEN_HEADER.toLowerCase()
      ],
    ).toBeUndefined();

    const registered = await http()
      .post('/api/runners/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ harnesses: [] });

    expect(registered.status).toBe(201);
    expect(registered.body.runnerId).toBe(made.body.id);
  });

  it('lets a runner be given its token, write-only, and replaces it on update', async () => {
    const given = randomUUID().replaceAll('-', '');
    const rotated = randomUUID().replaceAll('-', '');
    const made = await enrol({ name: 'build-1', token: given });
    const register = (token: string) =>
      http()
        .post('/api/runners/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ harnesses: [] });

    expect(made.headers[RUNNER_TOKEN_HEADER.toLowerCase()]).toBeUndefined();
    expect(made.body).not.toHaveProperty('token');
    expect((await register(given)).status).toBe(201);

    const answered = await http()
      .put(`/api/resources/runners/${made.body.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${made.body.version}"`)
      .send({ name: 'build-1', token: rotated });

    expect(answered.status).toBe(200);
    expect((await register(given)).status).toBe(401);
    expect((await register(rotated)).status).toBe(201);
    expect(
      (await enrol({ name: 'build-2', token: rotated })).body.errors,
    ).toEqual([
      expect.objectContaining({
        path: 'token',
        message: 'is already another runner’s token; give each runner its own',
      }),
    ]);
  });

  it('never takes back a token a deleted runner held, and says it was revoked', async () => {
    const given = randomUUID().replaceAll('-', '');
    const made = await enrol({ name: 'build-1', token: given });

    await http()
      .delete(`/api/resources/runners/${made.body.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${made.body.version}"`)
      .expect(204);

    const again = await enrol({ name: 'build-1', token: given });
    const other = await enrol({ name: 'build-2' });
    const rekeyed = await http()
      .put(`/api/resources/runners/${other.body.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${other.body.version}"`)
      .send({ name: 'build-2', token: given });

    for (const refused of [again, rekeyed]) {
      expect(refused.status).toBe(422);
      expect(refused.body.errors).toEqual([
        {
          path: 'token',
          message:
            'was held by a runner that has been revoked and can’t be used again; give this runner a new token',
          severity: 'error',
        },
      ]);
    }
  });

  it('shuts a deleted runner out', async () => {
    const made = await enrol({ name: 'build-1' });
    const token = made.headers[RUNNER_TOKEN_HEADER.toLowerCase()];

    await http()
      .delete(`/api/resources/runners/${made.body.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${made.body.version}"`)
      .expect(204);

    await http()
      .post('/api/runners/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ harnesses: [] })
      .expect(401);
    expect((await enrol({ name: 'build-1' })).status).toBe(201);
  });

  it('keeps its version while the runner comes and goes', async () => {
    const made = await enrol({ name: 'build-1' });

    await http()
      .post('/api/runners/register')
      .set(
        'Authorization',
        `Bearer ${made.headers[RUNNER_TOKEN_HEADER.toLowerCase()]}`,
      )
      .send({ harnesses: [] })
      .expect(201);

    const read = await http()
      .get(`/api/resources/runners/${made.body.id}`)
      .set(TEST_USER_HEADER, owner);

    expect(read.body).toEqual(made.body);
  });

  it('shows every runner enrolled outside what the workspace declares as drift', async () => {
    await enrol({ name: 'build-1' });
    await enrol({ name: 'laptop' });

    const declared = await http()
      .post(`/api/resources/workspaces/${held}/workspace-runners`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ runners: ['build-1', 'build-2'] });

    expect(declared.status).toBe(201);
    expect(declared.body.drift).toEqual(['laptop']);
    expect(declared.body.warnings).toEqual([
      expect.objectContaining({ path: 'runners[1]', severity: 'warning' }),
      expect.objectContaining({ path: 'runners', severity: 'warning' }),
    ]);
  });
});
