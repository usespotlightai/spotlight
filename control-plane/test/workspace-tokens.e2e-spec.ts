import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, TEST_USER_HEADER } from './support/app';
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const TOKEN_HEADER = 'spotlight-workspace-token';

const PROVIDER = 'terraform-provider/0.1.0';

const WHEN = 'integration.webhook.events[0].when';

const LINEAR = {
  integration: 'linear',
  webhook: {
    verify: { hmac: { secret: 'secret.LINEAR_SIGNING' } },
    events: [
      {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the definition's own expression syntax
        when: '${{ body.type == "Issue" }}',
        raise: {
          happening: 'linear.issue.completed',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the definition's own expression syntax
          marks: [{ kind: 'linear.issue', value: '${{ body.data.id }}' }],
        },
      },
    ],
  },
  actions: {
    comment: { request: { url: 'https://api.linear.app/graphql' } },
  },
};

const GRAFANA = {
  key: 'grafana',
  files: {
    'SKILL.md':
      '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch first.',
  },
};

const seats = async (db: DrizzleDatabase, about: string) => {
  const held = `${about}-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, held);

  return {
    ...seat,
    held,
    unseat: async () => {
      await db
        .delete(schema.idempotentCreate)
        .where(
          inArray(schema.idempotentCreate.scope, [
            `person:${seat.owner}`,
            `person:${seat.member}`,
          ]),
        );
      await db
        .delete(schema.configurationChange)
        .where(eq(schema.configurationChange.workspaceId, held));
      await db.delete(schema.secret).where(eq(schema.secret.workspaceId, held));
      await db
        .delete(schema.secretDataKey)
        .where(eq(schema.secretDataKey.workspaceId, held));
      await db
        .delete(schema.workspaceToken)
        .where(eq(schema.workspaceToken.workspaceId, held));
      await seat.unseat();
    },
  };
};

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const seat = await seats(app.get<DrizzleDatabase>(DRIZZLE), 'tokens');

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/workspaces/${seat.held}/tokens`,
    item: (id) => `/api/resources/tokens/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${seat.held}/tokens/import?address=${encodeURIComponent(address)}`,
    address: 'ci',
    valid: { name: 'ci', scopes: ['plan'], description: 'Plans every PR' },
    changed: { name: 'ci', scopes: ['plan'], description: 'Plans, again' },
    changedAgain: {
      name: 'ci',
      scopes: ['plan'],
      description: 'Plans, still',
    },
    invalid: {
      body: { name: 'ci', scopes: ['plan', 'apply'] },
      path: 'scopes[1]',
    },
    close: seat.unseat,
  };
};

conformsAsResource({ kind: 'workspace-token', open: seated });

describe('workspace tokens, acting in their workspace (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seats>>;
  let tokens: Record<'read' | 'plan' | 'configure' | 'secrets', string>;

  const http = () => request(app.getHttpServer());

  const issue = async (scopes: readonly string[], name = scopes.join('-')) => {
    const answer = await http()
      .post(`/api/resources/workspaces/${seat.held}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name, scopes });

    expect(answer.status).toBe(201);

    return answer;
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

  const teams = () => `/api/resources/workspaces/${seat.held}/teams`;

  const revoke = async (token: string) => {
    const [issued] = await db
      .select({ id: schema.workspaceToken.id })
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.tokenHash, sha(token)));

    return http()
      .delete(`/api/resources/tokens/${issued?.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"');
  };

  const FORBIDDEN_PROBLEM = {
    type: 'urn:spotlight:problem:forbidden',
    status: 403,
  };

  const audit = (who: string) =>
    http()
      .get(`/api/workspaces/${seat.held}/configuration-changes`)
      .set(TEST_USER_HEADER, who);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seat = await seats(db, 'acting');
    tokens = {
      read: (await issue(['read'])).headers[TOKEN_HEADER],
      plan: (await issue(['plan'])).headers[TOKEN_HEADER],
      configure: (await issue(['configure'])).headers[TOKEN_HEADER],
      secrets: (await issue(['configure', 'secrets'])).headers[TOKEN_HEADER],
    };
  });

  afterEach(async () => {
    await seat.unseat();
  });

  it('answers the token once, on its create, and keeps only its hash', async () => {
    const answer = await issue(['plan'], 'survey');
    const token = answer.headers[TOKEN_HEADER] as string;
    const read = await http()
      .get(`/api/resources/tokens/${answer.body.id}`)
      .set(TEST_USER_HEADER, seat.owner);
    const [kept] = await db
      .select({ hash: schema.workspaceToken.tokenHash })
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.id, answer.body.id));

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify(answer.body)).not.toContain(token);
    expect(read.headers[TOKEN_HEADER]).toBeUndefined();
    expect(JSON.stringify(read.body)).not.toContain(token);
    expect(kept?.hash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('lets a read token read its workspace, and nothing more', async () => {
    const read = as(tokens.read);
    const checked = await read.post('/api/expressions/check', {
      position: WHEN,
      expression: 'body.type == "Issue"',
      definition: LINEAR,
    });

    expect(
      (await read.get(`/api/resources/workspaces/${seat.held}`)).status,
    ).toBe(200);
    expect(checked.status).toBe(403);
    expect(checked.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(checked.body).toEqual({
      ...FORBIDDEN_PROBLEM,
      title: 'Not allowed to plan',
      detail:
        'Checking an expression is planning, which this token’s scopes do not allow',
    });
  });

  it('lets a plan token read and check expressions, but never apply', async () => {
    const plan = as(tokens.plan);
    const checked = await plan.post('/api/expressions/check', {
      position: WHEN,
      expression: 'body.type == "Issue"',
      definition: LINEAR,
    });
    const team = await http()
      .post(teams())
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'core', name: 'Core' });

    expect(checked.status).toBe(200);
    expect(checked.body.type).toBe('bool');
    expect(
      (await plan.get(`/api/resources/teams/${team.body.id}`)).status,
    ).toBe(200);
    expect((await plan.post(teams(), { key: 'ops', name: 'Ops' })).status).toBe(
      403,
    );
    expect(
      (
        await plan.put(`/api/resources/teams/${team.body.id}`, 0, {
          key: 'core',
          name: 'Planned',
        })
      ).status,
    ).toBe(403);
    expect(
      (await plan.delete(`/api/resources/teams/${team.body.id}`, 0)).status,
    ).toBe(403);
    expect(
      (
        await http()
          .get(`/api/resources/teams/${team.body.id}`)
          .set(TEST_USER_HEADER, seat.owner)
      ).body,
    ).toMatchObject({ name: 'Core', version: 0 });
  });

  it('lets a configure token change configuration as an admin would, each change recorded as the token through its client', async () => {
    const configure = as(tokens.configure);
    const made = await configure.post(teams(), { key: 'ops', name: 'Ops' });
    const renamed = await configure.put(
      `/api/resources/teams/${made.body.id}`,
      made.body.version,
      { key: 'ops', name: 'Operations' },
    );
    const skill = await configure.post(
      `/api/resources/teams/${made.body.id}/skills`,
      GRAFANA,
    );
    const removed = await configure.delete(
      `/api/resources/skills/${skill.body.id}`,
      skill.body.version,
    );
    const [issued] = await db
      .select({ id: schema.workspaceToken.id })
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.tokenHash, sha(tokens.configure)));

    expect([made.status, renamed.status, skill.status, removed.status]).toEqual(
      [201, 200, 201, 204],
    );

    const changes = (await audit(seat.owner)).body as {
      resource: string;
      action: string;
      key: string;
      by: { kind: string; tokenId: string | null; userId: string | null };
      client: string | null;
    }[];
    const byToken = changes.filter((each) => each.by.kind === 'token');

    expect(
      byToken.map((each) => [each.resource, each.action, each.key]),
    ).toEqual([
      ['skill', 'deleted', 'grafana'],
      ['skill', 'created', 'grafana'],
      ['team', 'updated', 'ops'],
      ['team', 'created', 'ops'],
    ]);

    for (const each of byToken) {
      expect(each).toMatchObject({
        client: PROVIDER,
        by: { kind: 'token', tokenId: issued?.id, userId: seat.owner },
      });
    }
  });

  it('records a person’s changes with the client they named, or as unknown', async () => {
    await http()
      .post(teams())
      .set(TEST_USER_HEADER, seat.owner)
      .set('Spotlight-Client', 'web')
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'web', name: 'Web' });
    await http()
      .post(teams())
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'bare', name: 'Bare' });

    const changes = (await audit(seat.owner)).body as {
      resource: string;
      key: string;
      by: { kind: string; userId: string };
      client: string;
    }[];

    expect(
      changes
        .filter((each) => each.resource === 'team')
        .map((each) => [each.key, each.by.kind, each.by.userId, each.client]),
    ).toEqual([
      ['bare', 'person', seat.owner, 'unknown'],
      ['web', 'person', seat.owner, 'web'],
    ]);
  });

  it('lets only a token with the secrets scope manage secrets, and any token read them', async () => {
    const secrets = `/api/resources/workspaces/${seat.held}/secrets`;
    const linear = {
      name: 'LINEAR_API_KEY',
      bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
      valueWo: 'lin_api_e2e',
      valueWoVersion: 1,
    };
    const capturing = {
      ...linear,
      bindings: [{ host: 'attacker.example' }],
    };

    expect((await as(tokens.configure).post(secrets, linear)).status).toBe(403);

    const made = await as(tokens.secrets).post(secrets, linear);
    const item = `/api/resources/secrets/${made.body.id}`;

    expect(made.status).toBe(201);
    expect((await as(tokens.read).get(item)).status).toBe(200);
    expect(
      (await as(tokens.configure).put(item, made.body.version, capturing))
        .status,
    ).toBe(403);
    expect(
      (await as(tokens.configure).delete(item, made.body.version)).status,
    ).toBe(403);

    const rotated = await as(tokens.secrets).put(item, made.body.version, {
      ...linear,
      valueWo: 'lin_api_e2e_2',
      valueWoVersion: 2,
    });

    expect(rotated.status).toBe(200);
    expect(
      (await as(tokens.secrets).delete(item, rotated.body.version)).status,
    ).toBe(204);

    const changes = (await audit(seat.owner)).body as {
      resource: string;
      action: string;
      by: { kind: string };
      details: object;
    }[];

    expect(
      changes
        .filter((each) => each.resource === 'secret')
        .map((each) => [each.action, each.by.kind, each.details]),
    ).toEqual([
      ['deleted', 'token', {}],
      ['updated', 'token', { valueVersion: 2 }],
      ['created', 'token', { valueVersion: 1, boundTo: ['api.linear.app'] }],
    ]);
  });

  it('refuses scopes that name no rung of the ladder, or name one twice', async () => {
    const refused = await http()
      .post(`/api/resources/workspaces/${seat.held}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'vault', scopes: ['secrets'] });

    expect(refused.status).toBe(422);
    expect(refused.body.errors).toEqual([
      expect.objectContaining({
        path: 'scopes',
        message: expect.stringContaining('beside one of them'),
      }),
    ]);
  });

  it('never lets a token manage tokens, open a workspace or read the audit', async () => {
    const configure = as(tokens.configure);

    expect(
      (
        await configure.post(`/api/resources/workspaces/${seat.held}/tokens`, {
          name: 'another',
          scopes: ['configure'],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await configure.post('/api/resources/workspaces', {
          name: 'Elsewhere',
          slug: `elsewhere-${randomUUID().slice(0, 8)}`,
        })
      ).body,
    ).toMatchObject({
      ...FORBIDDEN_PROBLEM,
      detail:
        'A workspace token acts only inside its own workspace and cannot open one; a person with a Spotlight account creates workspaces',
    });
    expect(
      (
        await configure.get(
          `/api/workspaces/${seat.held}/configuration-changes`,
        )
      ).status,
    ).toBe(401);
  });

  it('shows the audit only to the workspace’s admins', async () => {
    expect((await audit(seat.owner)).status).toBe(200);
    expect((await audit(seat.member)).status).toBe(404);
  });

  it('acts only within its own workspace', async () => {
    const elsewhere = await seats(db, 'elsewhere');

    try {
      expect(
        (
          await as(tokens.configure).get(
            `/api/resources/workspaces/${elsewhere.held}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await as(tokens.configure).post(
            `/api/resources/workspaces/${elsewhere.held}/teams`,
            { key: 'ops', name: 'Ops' },
          )
        ).status,
      ).toBe(404);
    } finally {
      await elsewhere.unseat();
    }
  });

  it('admits nobody once revoked or expired', async () => {
    const workspace = `/api/resources/workspaces/${seat.held}`;
    const [plan] = await db
      .select({ id: schema.workspaceToken.id })
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.tokenHash, sha(tokens.plan)));

    expect((await as(tokens.plan).get(workspace)).status).toBe(200);

    const revoked = await http()
      .delete(`/api/resources/tokens/${plan?.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"');

    expect(revoked.status).toBe(204);
    expect((await as(tokens.plan).get(workspace)).status).toBe(401);

    await db
      .update(schema.workspaceToken)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.workspaceToken.tokenHash, sha(tokens.read)));

    expect((await as(tokens.read).get(workspace)).status).toBe(401);
    expect((await as('made-up').get(workspace)).status).toBe(401);
  });

  it('keeps its workspace open until every token is revoked', async () => {
    await db.delete(schema.team).where(eq(schema.team.workspaceId, seat.held));

    const workspace = `/api/resources/workspaces/${seat.held}`;
    const close = () =>
      http()
        .delete(workspace)
        .set(TEST_USER_HEADER, seat.owner)
        .set('If-Match', '"0"');
    const refused = await close();

    expect(refused.status).toBe(409);
    expect(refused.body.detail).toContain(
      'token configure, token configure-secrets, token plan, token read',
    );

    for (const token of Object.values(tokens)) {
      await revoke(token);
    }

    expect((await close()).status).toBe(204);
  });

  it('never lets a configure token close its workspace, even one that holds nothing but that token', async () => {
    await db.delete(schema.team).where(eq(schema.team.workspaceId, seat.held));

    for (const token of [tokens.read, tokens.plan, tokens.secrets]) {
      expect((await revoke(token)).status).toBe(204);
    }

    const workspace = `/api/resources/workspaces/${seat.held}`;
    const refused = await as(tokens.configure).delete(workspace, 0);

    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({
      ...FORBIDDEN_PROBLEM,
      detail: expect.stringContaining('a token never administers'),
    });
    expect((await as(tokens.configure).get(workspace)).status).toBe(200);
  });

  it('is never taken by the routes only people use', async () => {
    expect((await as(tokens.configure).get('/api/workspaces')).status).toBe(
      401,
    );
  });
});

const sha = (token: string) => createHash('sha256').update(token).digest('hex');
