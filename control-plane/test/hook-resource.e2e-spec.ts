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
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const GRAFANA = {
  integration: 'grafana',
  name: 'Grafana',
  actions: {
    search: {
      request: { method: 'GET', url: 'https://grafana.example.com/api/search' },
    },
  },
  tools: {
    search: { description: 'Search dashboards', action: 'search' },
  },
};

const SECRET = `whsec_${Buffer.from('s'.repeat(32)).toString('base64')}`;

const GRAFANA_READS = {
  key: 'grafana-reads',
  on: 'tool.used',
  match: { tools: ['grafana.search'] },
  steps: [
    {
      name: 'audit',
      request: {
        url: 'https://127.0.0.1/audit',
        body: '$' + '{{ {"query": event.inputs.query} }}',
      },
    },
  ],
  signing: { secret: SECRET, secretVersion: 1 },
};

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `hooks-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  await db.insert(schema.integrationDefinition).values({
    id: randomUUID(),
    teamId: workspaceId,
    integration: 'grafana',
    definition: GRAFANA,
    tools: ['grafana.search'],
  });

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${workspaceId}/hooks`,
    item: (id) => `/api/resources/hooks/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/hooks/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) => `/api/resources/workspaces/${workspaceId}/hooks`,
    workspaceOf: () => workspaceId,
    address: 'team/grafana-reads',
    valid: GRAFANA_READS,
    changed: { ...GRAFANA_READS, timeoutSeconds: 20 },
    changedAgain: { ...GRAFANA_READS, timeoutSeconds: 25 },
    invalid: {
      body: { ...GRAFANA_READS, when: "event.argumnts.query != ''" },
      path: 'when',
    },
    close: async () => {
      await db
        .delete(schema.hookDefinition)
        .where(eq(schema.hookDefinition.teamId, workspaceId));
      await db
        .delete(schema.integrationDefinition)
        .where(eq(schema.integrationDefinition.teamId, workspaceId));
      await db
        .delete(schema.idempotentCreate)
        .where(
          inArray(schema.idempotentCreate.scope, [
            `person:${seat.owner}`,
            `person:${seat.member}`,
          ]),
        );
      await seat.unseat();
    },
  };
};

conformsAsResource({ kind: 'hook', open: seated });

describe('a hook, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;

  const create = (body: unknown) =>
    served(app)
      .post(fixture.collection)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('Idempotency-Key', randomUUID())
      .send(body as object);

  beforeAll(async () => {
    app = await openApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    fixture = await seated(app);
  });

  afterEach(async () => {
    await fixture.close();
  });

  it('never answers or stores its secret in the clear', async () => {
    const made = await create(GRAFANA_READS);
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const [row] = await db
      .select()
      .from(schema.hookDefinition)
      .where(eq(schema.hookDefinition.id, made.body.id));

    expect(made.status).toBe(201);
    expect(made.body.signing).toEqual({ secretVersion: 1 });
    expect(JSON.stringify(made.body)).not.toContain(SECRET);
    expect(JSON.stringify(row)).not.toContain(SECRET);
    expect(row?.signingSecret).toEqual(expect.any(String));
  });

  it('rejects a tool no integration of the team provides, pointing at it', async () => {
    const made = await create({
      ...GRAFANA_READS,
      match: { tools: ['grafana.dashboard'] },
    });

    expect(made.status).toBe(422);
    expect(made.body.errors).toEqual([
      expect.objectContaining({
        path: 'match.tools',
        message: expect.stringMatching(/grafana.dashboard/),
      }),
    ]);
  });

  it('keeps the integration offering a tool while a hook matches it', async () => {
    await create(GRAFANA_READS);

    const [integration] = await app
      .get<DrizzleDatabase>(DRIZZLE)
      .select()
      .from(schema.integrationDefinition)
      .where(
        eq(
          schema.integrationDefinition.teamId,
          fixture.collection.split('/')[4] ?? '',
        ),
      );
    const removed = await served(app)
      .put(`/api/resources/integrations/${integration?.id}`)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${integration?.version}"`)
      .send({ ...GRAFANA, tools: {} });

    expect(removed.status).toBe(409);
    expect(removed.body.detail).toMatch(/used by the hook grafana-reads/);
  });

  it('rejects a request to a host this Spotlight does not call', async () => {
    const made = await create({
      ...GRAFANA_READS,
      steps: [
        { name: 'audit', request: { url: 'https://audit.example.com/' } },
      ],
    });

    expect(made.status).toBe(422);
    expect(made.body.errors).toEqual([
      expect.objectContaining({
        path: 'steps[0].request.url',
        message: expect.stringMatching(/audit.example.com/),
      }),
    ]);
  });

  it('rejects a hook that blocks an event that has already happened', async () => {
    const made = await create({ ...GRAFANA_READS, failure: 'block' });

    expect(made.status).toBe(422);
    expect(made.body.errors).toEqual([
      expect.objectContaining({ path: 'failure' }),
    ]);
  });

  it('rejects OIDC signing where no key signs hook tokens', async () => {
    const made = await create({
      ...GRAFANA_READS,
      signing: { oidc: { audience: 'https://audit.example.com' } },
    });

    expect(made.status).toBe(422);
    expect(made.body.errors).toEqual([
      expect.objectContaining({ path: 'signing.oidc' }),
    ]);
  });

  it('checks a hook expression at plan, suggesting what was meant', async () => {
    const checked = await served(app)
      .post('/api/expressions/check')
      .set(TEST_USER_HEADER, fixture.admin)
      .send({
        position: 'hook.when',
        expression: "event.inputz.query != ''",
        definition: { ...GRAFANA_READS, signing: { secretVersion: 1 } },
      });

    expect(checked.status).toBe(200);
    expect(checked.body.errors).toEqual([
      expect.objectContaining({ suggestion: 'event.inputs' }),
    ]);
  });
});
