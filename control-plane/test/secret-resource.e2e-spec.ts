import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  SECRET_INJECTION,
  type SecretInjectionPort,
} from '@secrets/application/ports/secret-injection.port';
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
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const VALUE = 'lin_api_e2e_7f3a9c';

const LINEAR = {
  name: 'LINEAR_API_KEY',
  bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  valueWo: VALUE,
  valueWoVersion: 1,
};

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `secrets-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/workspaces/${workspaceId}/secrets`,
    item: (id) => `/api/resources/secrets/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/secrets/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) =>
      `/api/resources/workspaces/${workspaceId}/secrets`,
    workspaceOf: () => workspaceId,
    address: 'LINEAR_API_KEY',
    valid: LINEAR,
    changed: {
      ...LINEAR,
      bindings: [{ host: 'api.linear.app', name: 'x-api-key' }],
    },
    changedAgain: {
      ...LINEAR,
      bindings: [{ host: 'uploads.linear.app', prefix: 'Bearer ' }],
    },
    invalid: {
      body: { ...LINEAR, bindings: [{ host: 'https://api.linear.app' }] },
      path: 'bindings[0].host',
    },
    close: async () => {
      await db
        .delete(schema.idempotentCreate)
        .where(
          inArray(schema.idempotentCreate.scope, [
            `person:${seat.owner}`,
            `person:${seat.member}`,
          ]),
        );
      await db
        .delete(schema.secret)
        .where(eq(schema.secret.workspaceId, workspaceId));
      await db
        .delete(schema.configurationChange)
        .where(eq(schema.configurationChange.workspaceId, workspaceId));
      await db
        .delete(schema.secretDataKey)
        .where(eq(schema.secretDataKey.workspaceId, workspaceId));
      await seat.unseat();
    },
  };
};

conformsAsResource({ kind: 'secret', open: seated });

describe('a secret, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let fixture: ResourceFixture;
  let workspaceId: string;

  const as = (user: string) => {
    const http = served(app);

    return {
      create: (body: object) =>
        http
          .post(fixture.collection)
          .set(TEST_USER_HEADER, user)
          .set('Idempotency-Key', randomUUID())
          .send(body),
      read: (id: string) =>
        http.get(fixture.item(id)).set(TEST_USER_HEADER, user),
      update: (id: string, version: number, body: object) =>
        http
          .put(fixture.item(id))
          .set(TEST_USER_HEADER, user)
          .set('If-Match', `"${version}"`)
          .send(body),
      remove: (id: string, version: number) =>
        http
          .delete(fixture.item(id))
          .set(TEST_USER_HEADER, user)
          .set('If-Match', `"${version}"`),
      import: (address: string) =>
        http.get(fixture.importing(address)).set(TEST_USER_HEADER, user),
    };
  };

  const admin = () => as(fixture.admin);

  const injected = async (url = 'https://api.linear.app/graphql') => {
    const headers: Record<string, string> = {};

    (
      await app.get<SecretInjectionPort>(SECRET_INJECTION).forSpotlight({
        workspaceId,
        secrets: ['LINEAR_API_KEY'],
        url,
      })
    ).applyTo({ url: new URL(url), headers });

    return headers;
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fixture = await seated(app);
    workspaceId = fixture.collection.split('/')[4] ?? '';
  });

  afterEach(async () => {
    await fixture.close();
  });

  it('never answers its value, on any operation', async () => {
    const made = await admin().create(LINEAR);
    const answers = [
      made,
      await admin().read(made.body.id),
      await admin().import('LINEAR_API_KEY'),
      await admin().update(made.body.id, made.body.version, {
        ...LINEAR,
        valueWo: `${VALUE}_2`,
        valueWoVersion: 2,
      }),
    ];

    for (const answer of answers) {
      expect(answer.status).toBeLessThan(300);
      expect(answer.text).not.toContain(VALUE);
      expect(answer.body).not.toHaveProperty('valueWo');
    }

    expect(made.body).toMatchObject({
      name: 'LINEAR_API_KEY',
      source: { kind: 'built-in', secretId: null, field: null },
      bindings: [
        {
          host: 'api.linear.app',
          location: 'header',
          name: 'authorization',
          prefix: 'Bearer ',
        },
      ],
      valueWoVersion: 1,
    });
  });

  it('keeps its value encrypted under the data key of the workspace', async () => {
    const made = await admin().create(LINEAR);
    const [kept] = await db
      .select()
      .from(schema.secretValue)
      .where(eq(schema.secretValue.secretId, made.body.id));
    const keys = await db
      .select()
      .from(schema.secretDataKey)
      .where(eq(schema.secretDataKey.workspaceId, workspaceId));

    expect(kept?.ciphertext).toMatch(/^v1\./);
    expect(kept?.ciphertext).not.toContain(VALUE);
    expect(
      Buffer.from(kept?.ciphertext.split('.')[3] ?? '', 'base64').toString(),
    ).not.toContain(VALUE);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.keyId).toBe('local');
  });

  it('is injected for its host as soon as it is set', async () => {
    await admin().create(LINEAR);

    expect(await injected()).toEqual({ authorization: `Bearer ${VALUE}` });
  });

  it('is never injected for a host it is not bound to', async () => {
    await admin().create(LINEAR);

    await expect(injected('https://attacker.example/collect')).rejects.toThrow(
      /not bound to https:\/\/attacker\.example/,
    );
  });

  it('rotates through valueWoVersion, injected from the next request on', async () => {
    const made = await admin().create(LINEAR);

    const kept = await admin().update(made.body.id, made.body.version, {
      ...LINEAR,
      valueWo: `${VALUE}_ignored`,
    });
    expect(await injected()).toEqual({ authorization: `Bearer ${VALUE}` });

    const rotated = await admin().update(made.body.id, kept.body.version, {
      ...LINEAR,
      valueWo: `${VALUE}_2`,
      valueWoVersion: 2,
    });

    expect(rotated.status).toBe(200);
    expect(rotated.body.valueWoVersion).toBe(2);
    expect(await injected()).toEqual({ authorization: `Bearer ${VALUE}_2` });
  });

  it('rejects a new valueWoVersion that comes without its value', async () => {
    const made = await admin().create(LINEAR);
    const rejected = await admin().update(made.body.id, made.body.version, {
      ...LINEAR,
      valueWo: undefined,
      valueWoVersion: 2,
    });

    expect(rejected.status).toBe(422);
    expect(rejected.body.errors).toContainEqual(
      expect.objectContaining({ path: 'valueWo' }),
    );
    expect(await injected()).toEqual({ authorization: `Bearer ${VALUE}` });
  });

  it('lets only a workspace admin, or a token with the secrets scope, set, rotate or delete it', async () => {
    const member = as(fixture.viewer);
    const stranger = as(randomUUID());

    expect((await member.create(LINEAR)).status).toBe(403);
    expect((await stranger.create(LINEAR)).status).toBe(404);

    const made = await admin().create(LINEAR);
    const rotating = {
      ...LINEAR,
      valueWo: 'forged',
      valueWoVersion: 9,
    };

    expect(
      (await member.update(made.body.id, made.body.version, rotating)).status,
    ).toBe(403);
    expect((await member.remove(made.body.id, made.body.version)).status).toBe(
      403,
    );
    expect(
      (await stranger.update(made.body.id, made.body.version, rotating)).status,
    ).toBe(404);
    expect(
      (await stranger.remove(made.body.id, made.body.version)).status,
    ).toBe(404);
    expect(await injected()).toEqual({ authorization: `Bearer ${VALUE}` });
  });

  it('records every change as a configuration change: who made it and what moved, never the value', async () => {
    const made = await admin().create(LINEAR);
    const rebound = await admin().update(made.body.id, made.body.version, {
      ...LINEAR,
      bindings: [{ host: 'uploads.linear.app' }],
    });
    const rotated = await admin().update(made.body.id, rebound.body.version, {
      ...LINEAR,
      bindings: [{ host: 'uploads.linear.app' }],
      valueWo: `${VALUE}_2`,
      valueWoVersion: 2,
    });
    await admin().remove(made.body.id, rotated.body.version);

    const audit = await served(app)
      .get(`/api/workspaces/${workspaceId}/configuration-changes`)
      .set(TEST_USER_HEADER, fixture.admin);
    const changes = (
      audit.body as {
        resource: string;
        resourceId: string;
        action: string;
        by: { kind: string; userId: string | null };
        details: object;
      }[]
    ).filter((each) => each.resourceId === made.body.id);

    expect(
      changes
        .reverse()
        .map((each) => [each.resource, each.action, each.by, each.details]),
    ).toEqual([
      [
        'secret',
        'created',
        { kind: 'person', userId: fixture.admin, tokenId: null, trust: null },
        { valueVersion: 1, boundTo: ['api.linear.app'] },
      ],
      [
        'secret',
        'updated',
        { kind: 'person', userId: fixture.admin, tokenId: null, trust: null },
        { boundTo: ['uploads.linear.app'] },
      ],
      [
        'secret',
        'updated',
        { kind: 'person', userId: fixture.admin, tokenId: null, trust: null },
        { valueVersion: 2 },
      ],
      [
        'secret',
        'deleted',
        { kind: 'person', userId: fixture.admin, tokenId: null, trust: null },
        {},
      ],
    ]);
    expect(audit.text).not.toContain(VALUE);
  });

  it('deletes its value with the secret', async () => {
    const made = await admin().create(LINEAR);

    await admin().remove(made.body.id, made.body.version);

    expect(
      await db
        .select()
        .from(schema.secretValue)
        .where(eq(schema.secretValue.secretId, made.body.id)),
    ).toEqual([]);
    await expect(injected()).rejects.toThrow(/Secret [A-Z_]* not found/);
  });

  it('records no value in the outbox', async () => {
    await admin().create(LINEAR);

    const outbox = await db.select().from(schema.eventOutbox);

    expect(JSON.stringify(outbox)).not.toContain(VALUE);
  });
});
