import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  BOUND_SECRETS,
  type BoundSecretsPort,
} from '@secrets/application/ports/bound-secrets.port';
import {
  SECRET_INJECTION,
  type SecretInjectionPort,
} from '@secrets/application/ports/secret-injection.port';
import {
  SECRET_READINESS,
  type SecretReadinessPort,
} from '@secrets/application/ports/secret-readiness.port';
import { asc, eq, inArray } from 'drizzle-orm';
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
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const WORKSPACE_TOKEN_HEADER = 'spotlight-workspace-token';

const STAGING = {
  name: 'STAGING_LOGIN_PASSWORD',
  bindings: [{ host: 'staging.example.com', prefix: 'Bearer ' }],
};

const LINEAR = {
  name: 'LINEAR_API_KEY',
  bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  valueWo: 'lin_api_e2e_1',
  valueWoVersion: 1,
};

type Listed = { name: string; valueOrigin: string; settable: boolean };

describe('secret values set outside Terraform (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let member: string;
  let unseat: () => Promise<void>;

  const http = () => served(app);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `values-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    member = seat.member;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    const issued = await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspaceId))
      .returning({ id: schema.workspaceToken.id });

    await db
      .delete(schema.idempotentCreate)
      .where(
        inArray(schema.idempotentCreate.scope, [
          `person:${owner}`,
          `person:${member}`,
          ...issued.map((each) => `token:${each.id}`),
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
    await unseat();
  });

  const defined = async (body: object) => {
    const created = await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/secrets`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

    expect(created.status).toBe(201);

    return bodyOf<{ id: string; version: number }>(created);
  };

  const tokenWith = async (scopes: readonly string[]) => {
    const issued = await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/tokens`)
      .set(TEST_USER_HEADER, owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: scopes.join('-'), scopes });

    expect(issued.status).toBe(201);

    return issued.headers[WORKSPACE_TOKEN_HEADER];
  };

  const setAs = (user: string, name: string, value: string) =>
    http()
      .put(`/api/workspaces/${workspaceId}/secrets/${name}/value`)
      .set(TEST_USER_HEADER, user)
      .send({ value });

  const setWith = (token: string, name: string, value: string) =>
    http()
      .put(`/api/workspaces/${workspaceId}/secrets/${name}/value`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value });

  const listedAs = async (user: string): Promise<Listed[]> => {
    const listed = await http()
      .get(`/api/workspaces/${workspaceId}/secrets`)
      .set(TEST_USER_HEADER, user);

    expect(listed.status).toBe(200);

    return bodyOf<Listed[]>(listed);
  };

  const injected = async (name: string, url: string) =>
    (
      await app.get<SecretInjectionPort>(SECRET_INJECTION).forSpotlight({
        workspaceId,
        secrets: [name],
        url,
      })
    ).injected
      .filter((each) => each.location === 'header')
      .map((each) => each.value.revealed());

  it('lists a secret Terraform defined without a value as awaiting one', async () => {
    await defined(STAGING);
    await defined(LINEAR);

    expect(await listedAs(owner)).toEqual([
      expect.objectContaining({
        name: 'LINEAR_API_KEY',
        valueOrigin: 'terraform',
        settable: false,
      }),
      expect.objectContaining({
        name: 'STAGING_LOGIN_PASSWORD',
        valueOrigin: 'awaiting',
        settable: true,
      }),
    ]);
  });

  it('stores a value a person sets, injects it, and never answers with it', async () => {
    await defined(STAGING);

    const set = await setAs(owner, STAGING.name, 'hunter2');

    expect(set.status).toBe(204);
    expect(
      await injected(STAGING.name, 'https://staging.example.com/login'),
    ).toEqual(['Bearer hunter2']);
    const listed = await listedAs(owner);
    expect(listed[0]).toMatchObject({ valueOrigin: 'spotlight' });
    expect(JSON.stringify(listed)).not.toContain('hunter2');
  });

  it('keeps the value a person set when Terraform updates the secret without one', async () => {
    const created = await defined(STAGING);
    await setAs(owner, STAGING.name, 'hunter2');
    const current = await http()
      .get(`/api/v1/resources/secrets/${created.id}`)
      .set(TEST_USER_HEADER, owner);

    const updated = await http()
      .put(`/api/v1/resources/secrets/${created.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${bodyOf<{ version: number }>(current).version}"`)
      .send({
        ...STAGING,
        bindings: [{ host: 'staging.example.com', prefix: 'Token ' }],
      });

    expect(updated.status).toBe(200);
    expect(
      await injected(STAGING.name, 'https://staging.example.com/login'),
    ).toEqual(['Token hunter2']);
  });

  it('refuses a value that Terraform sets', async () => {
    await defined(LINEAR);

    const set = await setAs(owner, LINEAR.name, 'lin_api_e2e_2');

    expect(set.status).toBe(409);
    expect(
      await injected(LINEAR.name, 'https://api.linear.app/graphql'),
    ).toEqual(['Bearer lin_api_e2e_1']);
  });

  it('refuses a value Terraform sends without valueWoVersion', async () => {
    const created = await defined(STAGING);

    const updated = await http()
      .put(`/api/v1/resources/secrets/${created.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${created.version}"`)
      .send({ ...STAGING, valueWo: 'from-terraform' });

    expect(updated.status).toBe(422);
    expect((await listedAs(owner))[0]).toMatchObject({
      valueOrigin: 'awaiting',
    });
  });

  it('finds no secret that Spotlight keeps for itself', async () => {
    expect(
      (await setAs(owner, 'SPOTLIGHT_ANTHROPIC_API_KEY', 'x')).status,
    ).toBe(404);
  });

  it('refuses a value on more than one line', async () => {
    await defined(STAGING);

    expect((await setAs(owner, STAGING.name, 'a\nb')).status).toBe(422);
  });

  it('lets a member see the secrets, but not set a value', async () => {
    await defined(STAGING);

    expect((await listedAs(member))[0]).toMatchObject({ settable: false });
    expect((await setAs(member, STAGING.name, 'hunter2')).status).toBe(403);
  });

  it('takes a value from a token with the secrets scope only', async () => {
    await defined(STAGING);

    expect(
      (await setWith(await tokenWith(['configure']), STAGING.name, 'x')).status,
    ).toBe(403);
    expect(
      (
        await setWith(
          await tokenWith(['configure', 'secrets']),
          STAGING.name,
          'x',
        )
      ).status,
    ).toBe(204);
  });

  it('finds no secret under another name or in another workspace', async () => {
    await defined(STAGING);

    expect((await setAs(owner, 'NOT_THERE', 'x')).status).toBe(404);
    expect(
      (
        await http()
          .put(
            `/api/workspaces/elsewhere-${workspaceId}/secrets/${STAGING.name}/value`,
          )
          .set(TEST_USER_HEADER, owner)
          .send({ value: 'x' })
      ).status,
    ).toBe(404);
  });

  it('hands the value over when Terraform removes valueWoVersion, and records each value change apart', async () => {
    const created = await defined(LINEAR);

    const handedOver = await http()
      .put(`/api/v1/resources/secrets/${created.id}`)
      .set(TEST_USER_HEADER, owner)
      .set('If-Match', `"${created.version}"`)
      .send({ name: LINEAR.name, bindings: LINEAR.bindings });

    expect(handedOver.status).toBe(200);
    expect(
      await injected(LINEAR.name, 'https://api.linear.app/graphql'),
    ).toEqual(['Bearer lin_api_e2e_1']);
    expect((await listedAs(owner))[0]).toMatchObject({
      valueOrigin: 'spotlight',
      settable: true,
    });

    expect((await setAs(owner, LINEAR.name, 'lin_api_e2e_2')).status).toBe(204);
    expect(
      await injected(LINEAR.name, 'https://api.linear.app/graphql'),
    ).toEqual(['Bearer lin_api_e2e_2']);

    const history = await db
      .select({
        action: schema.configurationChange.action,
        details: schema.configurationChange.details,
      })
      .from(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, workspaceId))
      .orderBy(asc(schema.configurationChange.seq));

    expect(
      history.filter(
        (each) =>
          'valueChange' in each.details || 'valueOrigin' in each.details,
      ),
    ).toEqual([
      {
        action: 'created',
        details: {
          valueChange: 'stored',
          valueOrigin: 'terraform',
          valueVersion: 1,
          targets: ['api.linear.app'],
          sandbox: 'stand-in',
        },
      },
      {
        action: 'updated',
        details: { valueChange: 'handed-over', valueOrigin: 'spotlight' },
      },
      {
        action: 'updated',
        details: { valueChange: 'stored', valueOrigin: 'spotlight' },
      },
    ]);
  });

  it('refuses to inject a secret that awaits a value, and says how to set it', async () => {
    await defined(STAGING);

    await expect(
      injected(STAGING.name, 'https://staging.example.com/login'),
    ).rejects.toThrow(
      /Secret STAGING_LOGIN_PASSWORD has no value\. Set it on the Secrets settings page/,
    );
  });

  it('names the secrets that await a value, in one lookup', async () => {
    await defined(STAGING);
    await defined(LINEAR);

    expect(
      await app
        .get<SecretReadinessPort>(SECRET_READINESS)
        .awaitingValue(workspaceId, [LINEAR.name, STAGING.name, 'NOT_DEFINED']),
    ).toEqual([STAGING.name]);
  });

  it('tells for each named secret what a request sends to its hosts, and whether it awaits a value', async () => {
    await defined(STAGING);
    await defined(LINEAR);

    expect(
      await app
        .get<BoundSecretsPort>(BOUND_SECRETS)
        .boundIn(workspaceId, [LINEAR.name, STAGING.name, 'NOT_DEFINED']),
    ).toEqual(
      expect.arrayContaining([
        {
          name: LINEAR.name,
          bindings: [
            {
              host: 'api.linear.app',
              location: 'header',
              name: 'authorization',
              sent: `Bearer spotlight-egress:${LINEAR.name}`,
            },
          ],
          awaitingValue: false,
          allowsSandbox: false,
        },
        {
          name: STAGING.name,
          bindings: [
            {
              host: 'staging.example.com',
              location: 'header',
              name: 'authorization',
              sent: `Bearer spotlight-egress:${STAGING.name}`,
            },
          ],
          awaitingValue: true,
          allowsSandbox: false,
        },
      ]),
    );
  });
});
