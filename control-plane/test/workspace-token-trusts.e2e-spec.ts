import { randomUUID } from 'node:crypto';
import { MintedTokens } from '@identity/application/services/minted-tokens.service';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  openWorkloadIssuer,
  type WorkloadIssuer,
} from '@platform/workload/workload-issuer.fake-spec';
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
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const PROVIDER = 'terraform-provider/0.2.0';

const REPOSITORY = 'acme/platform';

const MAIN = `repo:${REPOSITORY}:ref:refs/heads/main`;

const PULL_REQUEST = `repo:${REPOSITORY}:pull_request`;

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
};

const seats = async (db: DrizzleDatabase, about: string) => {
  const workspaceId = `${about}-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  return {
    ...seat,
    workspaceId,
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
        .where(eq(schema.configurationChange.workspaceId, workspaceId));
      await db
        .delete(schema.workspaceToken)
        .where(eq(schema.workspaceToken.workspaceId, workspaceId));
      await db
        .delete(schema.workspaceTokenTrust)
        .where(eq(schema.workspaceTokenTrust.workspaceId, workspaceId));
      await seat.unseat();
    },
  };
};

let issuer: WorkloadIssuer;

beforeAll(async () => {
  issuer = await openWorkloadIssuer();
});

afterAll(async () => {
  await issuer.close();
});

const trusting = (over: object = {}) => ({
  key: 'github-main',
  issuer: issuer.issuer,
  subject: MAIN,
  claims: { repository: REPOSITORY },
  scopes: ['configure'],
  ...over,
});

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const seat = await seats(app.get<DrizzleDatabase>(DRIZZLE), 'token-trusts');

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
    item: (id) => `/api/resources/token-trusts/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${seat.workspaceId}/token-trusts/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) =>
      `/api/resources/workspaces/${workspaceId}/token-trusts`,
    workspaceOf: () => seat.workspaceId,
    address: 'github-main',
    valid: trusting(),
    changed: trusting({ scopes: ['plan'] }),
    changedAgain: trusting({ lifetimeMinutes: 5 }),
    invalid: {
      body: trusting({ lifetimeMinutes: 61 }),
      path: 'lifetimeMinutes',
    },
    close: seat.unseat,
  };
};

conformsAsResource({ kind: 'workspace-token-trust', open: seated });

describe('CI exchanging its OIDC token for a short-lived workspace token (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seats>>;

  const http = () => served(app);

  const define = async (body: object) => {
    const made = await http()
      .post(`/api/resources/workspaces/${seat.workspaceId}/token-trusts`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

    expect(made.status).toBe(201);

    return made.body as { id: string; version: number };
  };

  const exchange = (trust: string, token: string) =>
    http()
      .post('/api/workspace-tokens/exchange')
      .set('Spotlight-Client', PROVIDER)
      .send({ trust, token });

  const workload = (sub: string, claims: object = {}) =>
    issuer.issue({
      sub,
      aud: 'spotlight',
      repository: REPOSITORY,
      ref: 'refs/heads/main',
      ...claims,
    });

  const exchanged = async (trust: string, sub: string) => {
    const answer = await exchange(trust, await workload(sub));

    expect(answer.status).toBe(200);

    return answer.body as {
      token: string;
      tokenId: string;
      workspaceId: string;
      scopes: string[];
      expiresAt: string;
    };
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
  });

  const teams = () => `/api/resources/workspaces/${seat.workspaceId}/teams`;

  const audit = async () =>
    (
      await http()
        .get(`/api/workspaces/${seat.workspaceId}/configuration-changes`)
        .set(TEST_USER_HEADER, seat.owner)
    ).body as {
      resource: string;
      key: string;
      action: string;
      by: { kind: string; tokenId: string; userId: string; trust: string };
      client: string;
      details: Record<string, unknown>;
    }[];

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seat = await seats(db, 'exchange');
  });

  afterEach(async () => {
    await db.delete(schema.team).where(eq(schema.team.key, 'platform'));
    await seat.unseat();
  });

  it('lets a workflow on main apply with no stored token, within the trust’s scopes', async () => {
    const trust = await define(trusting({ scopes: ['configure'] }));
    const minted = await exchanged(trust.id, MAIN);
    const created = await as(minted.token).post(teams(), {
      key: 'platform',
      name: 'Platform',
    });

    expect(minted).toMatchObject({
      workspaceId: seat.workspaceId,
      scopes: ['configure'],
    });
    expect(created.status).toBe(201);
  });

  it('lets a pull request plan but denies it the apply', async () => {
    const plans = await define(
      trusting({
        key: 'github-pull-requests',
        subject: PULL_REQUEST,
        scopes: ['plan'],
      }),
    );
    const minted = await exchanged(plans.id, PULL_REQUEST);
    const plan = as(minted.token);
    const checked = await plan.post('/api/expressions/check', {
      position: WHEN,
      expression: 'body.type == "Issue"',
      definition: LINEAR,
    });
    const applied = await plan.post(teams(), {
      key: 'platform',
      name: 'Platform',
    });

    expect(
      (await plan.get(`/api/resources/workspaces/${seat.workspaceId}`)).status,
    ).toBe(200);
    expect(checked.status).toBe(200);
    expect(applied.status).toBe(403);
    expect(applied.body).toMatchObject({
      type: 'urn:spotlight:problem:forbidden',
      permission: 'configure',
    });
  });

  it('does not accept a workload the trust does not admit, one signed by another key, and a trust that does not exist', async () => {
    const trust = await define(trusting());
    const forged = await issuer.forge({
      sub: MAIN,
      aud: 'spotlight',
      repository: REPOSITORY,
    });

    expect(
      (await exchange(trust.id, await workload(PULL_REQUEST))).status,
    ).toBe(401);
    expect(
      (
        await exchange(
          trust.id,
          await workload(MAIN, { repository: 'acme/elsewhere' }),
        )
      ).status,
    ).toBe(401);
    expect((await exchange(trust.id, forged)).status).toBe(401);
    expect(
      (
        await exchange(
          trust.id,
          await issuer.issue({
            sub: MAIN,
            aud: 'vault',
            repository: REPOSITORY,
          }),
        )
      ).status,
    ).toBe(401);
    expect((await exchange(randomUUID(), await workload(MAIN))).status).toBe(
      401,
    );
    expect((await exchange('', '')).status).toBe(401);
  });

  it('mints a token that expires within the trust’s lifetime', async () => {
    const trust = await define(trusting({ lifetimeMinutes: 5 }));
    const before = Date.now();
    const minted = await exchanged(trust.id, MAIN);
    const lasts = new Date(minted.expiresAt).getTime() - before;

    expect(lasts).toBeGreaterThan(4 * 60_000);
    expect(lasts).toBeLessThanOrEqual(5 * 60_000 + 1_000);
  });

  it('rejects a lifetime longer than an hour', async () => {
    const rejected = await http()
      .post(`/api/resources/workspaces/${seat.workspaceId}/token-trusts`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(trusting({ lifetimeMinutes: 61 }));

    expect(rejected.status).toBe(422);
    expect(rejected.body.errors).toEqual([
      expect.objectContaining({ path: 'lifetimeMinutes' }),
    ]);
  });

  it('stops every token it minted the moment the trust is deleted, and revokes them', async () => {
    const trust = await define(trusting());
    const minted = await exchanged(trust.id, MAIN);

    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(200);

    const deleted = await http()
      .delete(`/api/resources/token-trusts/${trust.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"');

    expect(deleted.status).toBe(204);
    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(401);
    await eventually(async () => {
      const left = await db
        .select({ id: schema.workspaceToken.id })
        .from(schema.workspaceToken)
        .where(eq(schema.workspaceToken.id, minted.tokenId));

      return left.length === 0;
    });
  });

  it('stops the tokens a trust minted once the trust is changed, and mints under the change', async () => {
    const trust = await define(trusting({ scopes: ['configure'] }));
    const minted = await exchanged(trust.id, MAIN);

    const narrowed = await http()
      .put(`/api/resources/token-trusts/${trust.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"')
      .send(trusting({ scopes: ['plan'] }));

    expect(narrowed.status).toBe(200);
    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(401);
    expect((await exchanged(trust.id, MAIN)).scopes).toEqual(['plan']);
  });

  it('keeps the tokens it minted when applied again unchanged', async () => {
    const trust = await define(trusting());
    const minted = await exchanged(trust.id, MAIN);
    const reapplied = await http()
      .put(`/api/resources/token-trusts/${trust.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"')
      .send(trusting());

    expect(reapplied.status).toBe(200);
    expect(reapplied.body.version).toBe(0);
    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(200);
  });

  it('records each exchange and each change made with a minted token against its trust', async () => {
    const trust = await define(trusting());
    const minted = await exchanged(trust.id, MAIN);

    await as(minted.token).post(teams(), { key: 'platform', name: 'Platform' });

    const changes = await audit();
    const exchange = changes.find(
      (each) => each.resource === 'workspace-token',
    );
    const team = changes.find((each) => each.resource === 'team');

    expect(exchange).toMatchObject({
      action: 'created',
      key: 'github-main',
      client: PROVIDER,
      by: {
        kind: 'token',
        tokenId: minted.tokenId,
        userId: seat.owner,
        trust: trust.id,
      },
      details: {
        trust: trust.id,
        subject: MAIN,
        scopes: ['configure'],
        expiresAt: minted.expiresAt,
      },
    });
    expect(team).toMatchObject({
      action: 'created',
      key: 'platform',
      by: { kind: 'token', tokenId: minted.tokenId, trust: trust.id },
    });
  });

  it('never lists a minted token among the workspace’s tokens, yet lets an admin revoke one by its id', async () => {
    const trust = await define(trusting());
    const minted = await exchanged(trust.id, MAIN);
    const listed = await http()
      .get(`/api/resources/workspaces/${seat.workspaceId}/tokens`)
      .set(TEST_USER_HEADER, seat.owner);

    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain(minted.tokenId);

    const item = `/api/resources/tokens/${minted.tokenId}`;
    const read = await http().get(item).set(TEST_USER_HEADER, seat.owner);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ name: 'github-main' });
    expect(
      (
        await http()
          .put(item)
          .set(TEST_USER_HEADER, seat.owner)
          .set('If-Match', '"0"')
          .send({
            name: 'github-main',
            description: 'described',
            scopes: ['configure'],
            expiresAt: minted.expiresAt,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await http()
          .delete(item)
          .set(TEST_USER_HEADER, seat.owner)
          .set('If-Match', '"0"')
      ).status,
    ).toBe(204);
    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(401);
  });

  it('leaves trusts to the workspace’s admins and to tokens granted trusts', async () => {
    const trust = await define(
      trusting({ scopes: ['configure', 'secrets', 'runners'] }),
    );
    const minted = await exchanged(trust.id, MAIN);
    const forbidden = await as(minted.token).post(
      `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
      trusting({ key: 'another' }),
    );

    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ permission: 'manage-token-trusts' });
    expect(
      (
        await http()
          .post(`/api/resources/workspaces/${seat.workspaceId}/token-trusts`)
          .set(TEST_USER_HEADER, seat.member)
          .set('Idempotency-Key', randomUUID())
          .send(trusting({ key: 'another' }))
      ).status,
    ).toBe(403);
  });

  it('lets a token grant through a trust no scope it does not have, nor take over or remove one it could not have made', async () => {
    const issue = async (scopes: string[]) =>
      (
        await http()
          .post(`/api/resources/workspaces/${seat.workspaceId}/tokens`)
          .set(TEST_USER_HEADER, seat.owner)
          .set('Idempotency-Key', randomUUID())
          .send({ name: scopes.join('-'), scopes })
      ).headers['spotlight-workspace-token'] as string;
    const narrow = as(await issue(['configure', 'trusts']));
    const withoutTrusts = as(await issue(['configure', 'secrets', 'runners']));
    const secrets = await define(
      trusting({ scopes: ['configure', 'secrets'] }),
    );
    const escalating = await narrow.post(
      `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
      trusting({ key: 'mine', scopes: ['configure', 'secrets'] }),
    );
    const takeover = await http()
      .put(`/api/resources/token-trusts/${secrets.id}`)
      .set('Authorization', `Bearer ${await issue(['plan', 'trusts'])}`)
      .set('If-Match', '"0"')
      .send(trusting({ subject: PULL_REQUEST, scopes: ['plan'] }));
    const updating = await http()
      .put(`/api/resources/token-trusts/${secrets.id}`)
      .set('Authorization', `Bearer ${await issue(['configure', 'runners'])}`)
      .set('If-Match', '"0"')
      .send(trusting({ scopes: ['plan'] }));
    const removing = await http()
      .delete(`/api/resources/token-trusts/${secrets.id}`)
      .set('Authorization', `Bearer ${await issue(['configure', 'secrets'])}`)
      .set('If-Match', '"0"');
    const withdrawing = await http()
      .delete(`/api/resources/token-trusts/${secrets.id}`)
      .set('Authorization', `Bearer ${await issue(['trusts', 'plan'])}`)
      .set('If-Match', '"0"');

    for (const forbidden of [
      escalating,
      takeover,
      updating,
      removing,
      withdrawing,
    ]) {
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toMatchObject({
        permission: 'manage-token-trusts',
      });
    }
    expect(
      (
        await withoutTrusts.post(
          `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
          trusting({ key: 'mine', scopes: ['plan'] }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await narrow.post(
          `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
          trusting({ key: 'mine', scopes: ['configure'] }),
        )
      ).status,
    ).toBe(201);
  });

  it('bootstraps CI once with a trusts token, then plans and applies with none stored', async () => {
    const issued = await http()
      .post(`/api/resources/workspaces/${seat.workspaceId}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'bootstrap', scopes: ['configure', 'trusts'] });
    const bootstrap = as(issued.headers['spotlight-workspace-token'] as string);
    const plans = await bootstrap.post(
      `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
      trusting({
        key: 'github-pull-requests',
        subject: PULL_REQUEST,
        scopes: ['plan'],
      }),
    );
    const applies = await bootstrap.post(
      `/api/resources/workspaces/${seat.workspaceId}/token-trusts`,
      trusting({ scopes: ['configure'] }),
    );

    expect([plans.status, applies.status]).toEqual([201, 201]);
    expect(applies.body.definedBy).toBe(seat.owner);

    expect(
      (
        await http()
          .delete(`/api/resources/tokens/${issued.body.id}`)
          .set(TEST_USER_HEADER, seat.owner)
          .set('If-Match', '"0"')
      ).status,
    ).toBe(204);

    const pullRequest = as(
      (await exchanged(plans.body.id, PULL_REQUEST)).token,
    );
    const main = as((await exchanged(applies.body.id, MAIN)).token);

    expect(
      (await pullRequest.post(teams(), { key: 'platform', name: 'Platform' }))
        .status,
    ).toBe(403);
    expect(
      (await main.post(teams(), { key: 'platform', name: 'Platform' })).status,
    ).toBe(201);
  });

  it('will not close the workspace while it trusts a workload', async () => {
    await define(trusting());

    const closing = await http()
      .delete(`/api/resources/workspaces/${seat.workspaceId}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', '"0"');

    expect(closing.status).toBe(409);
    expect(JSON.stringify(closing.body)).toContain('token trust github-main');
  });

  it('lets go of minted tokens once they expire', async () => {
    const trust = await define(trusting());
    const minted = await exchanged(trust.id, MAIN);

    await db
      .update(schema.workspaceToken)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.workspaceToken.id, minted.tokenId));

    expect(
      (
        await as(minted.token).get(
          `/api/resources/workspaces/${seat.workspaceId}`,
        )
      ).status,
    ).toBe(401);

    await app.get(MintedTokens).pruneExpired();

    expect(
      await db
        .select({ id: schema.workspaceToken.id })
        .from(schema.workspaceToken)
        .where(eq(schema.workspaceToken.id, minted.tokenId)),
    ).toEqual([]);
  });
});
