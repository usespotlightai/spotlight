import { randomUUID } from 'node:crypto';
import { CatalogEntitlements } from '@catalog/application/services/catalog-entitlements.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { DrizzleMeteredCalls } from '@catalog/infrastructure/persistence/drizzle/ledgers/metered-calls.ledger';
import { DrizzleWorkspacePlans } from '@catalog/infrastructure/persistence/drizzle/readers/workspace-plans.reader';
import type { INestApplication } from '@nestjs/common';
import { buildOpenApiDocument } from '@platform/http/openapi';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
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
import { definitionOf } from './support/line-definition';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const PROBLEM = 'application/problem+json';

describe('the catalog, read as Terraform data sources (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspace: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const onPlan = (plan: string, expiresAt: Date | null = null) =>
    db.insert(schema.workspacePlan).values({
      workspaceId: workspace,
      plan,
      expiresAt,
    });

  const read = (
    kind: 'tools' | 'skills',
    query: Record<string, string>,
    as: string = seat.member,
  ) =>
    served(app)
      .get(`/api/v1/resources/workspaces/${workspace}/catalog/${kind}`)
      .query(query)
      .set(TEST_USER_HEADER, as);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspace = `catalog-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, workspace);
  });

  afterEach(async () => {
    await db
      .delete(schema.workspacePlan)
      .where(eq(schema.workspacePlan.workspaceId, workspace));
    await seat.unseat();
  });

  it('resolves a name and constraint to the newest version it accepts, with the version in the id', async () => {
    await onPlan('team');

    const answer = await read('tools', {
      name: 'web-search',
      version: '~> 1.0',
    });

    expect(answer.status).toBe(200);
    expect(answer.headers['spotlight-api-version']).toBeDefined();
    expect(answer.body).toEqual({
      id: 'catalog.web-search@1.1.0',
      name: 'web-search',
      version: '1.1.0',
      constraint: '~> 1.0',
      plan: 'team',
      description: expect.any(String),
    });
  });

  it('answers a skill with the tools it uses, and never its files', async () => {
    await onPlan('team');

    const answer = await read('skills', { name: 'research', version: '1.0.0' });

    expect(answer.status).toBe(200);
    expect(answer.body.id).toBe('catalog.research@1.0.0');
    expect(answer.body.tools).toEqual([
      'catalog.web-search@1.1.0',
      'catalog.fetch-page@1.0.0',
    ]);
    expect(answer.body).not.toHaveProperty('files');
  });

  it('fails the plan for an item the workspace’s plan does not include, saying which plan it requires', async () => {
    const answer = await read('tools', {
      name: 'web-search',
      version: '~> 1.0',
    });

    expect(answer.status).toBe(403);
    expect(answer.headers['content-type']).toContain(PROBLEM);
    expect(answer.body).toMatchObject({
      type: 'urn:spotlight:problem:not-entitled',
      status: 403,
      detail:
        'Catalog item catalog.web-search@1.1.0 requires the Team plan. Workspace plan: Free',
    });
  });

  it('fails it just the same once the plan has expired', async () => {
    await onPlan('team', new Date('2020-01-01T00:00:00.000Z'));

    const answer = await read('tools', {
      name: 'web-search',
      version: '1.0.0',
    });

    expect(answer.status).toBe(403);
    expect(answer.body.detail).toContain('requires the Team plan');
  });

  it('resolves what the free plan includes without any plan on record', async () => {
    const answer = await read('tools', {
      name: 'fetch-page',
      version: '~> 1.0',
    });

    expect(answer.status).toBe(200);
    expect(answer.body.id).toBe('catalog.fetch-page@1.0.0');
  });

  it('says which versions there are when none matches', async () => {
    await onPlan('team');

    const answer = await read('tools', {
      name: 'web-search',
      version: '~> 2.0',
    });

    expect(answer.status).toBe(404);
    expect(answer.body.detail).toBe(
      'No version of catalog tool web-search matches ~> 2.0. Available versions: 1.0.0, 1.1.0',
    );
  });

  it('requires a version constraint, pointing at it', async () => {
    const answer = await read('tools', { name: 'web-search' });

    expect(answer.status).toBe(422);
    expect(answer.body.errors).toContainEqual(
      expect.objectContaining({ path: 'version' }),
    );
  });

  it('answers a workspace token that may read the workspace', async () => {
    await onPlan('team');

    const issued = await served(app)
      .post(`/api/v1/resources/workspaces/${workspace}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'terraform', scopes: ['read'] });

    const answer = await served(app)
      .get(`/api/v1/resources/workspaces/${workspace}/catalog/tools`)
      .query({ name: 'web-search', version: '~> 1.0' })
      .set(
        'Authorization',
        `Bearer ${issued.headers['spotlight-workspace-token']}`,
      );

    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspace));

    expect(issued.status).toBe(201);
    expect(answer.status).toBe(200);
    expect(answer.body.id).toBe('catalog.web-search@1.1.0');
  });

  it('answers nobody outside the workspace', async () => {
    await onPlan('team');

    const answer = await read(
      'tools',
      { name: 'web-search', version: '~> 1.0' },
      randomUUID(),
    );

    expect(answer.status).toBe(404);
  });

  it('documents both data sources, and how a plan can fail them', () => {
    const operations = Object.values(buildOpenApiDocument(app).paths).flatMap(
      (methods) => Object.values(methods as Record<string, unknown>),
    ) as {
      operationId?: string;
      responses: Record<string, { content?: Record<string, unknown> }>;
    }[];

    for (const id of ['readCatalogTool', 'readCatalogSkill']) {
      const operation = operations.find((each) => each.operationId === id);

      expect(operation?.responses['403']?.content).toHaveProperty([PROBLEM]);
      expect(operation?.responses['422']?.content).toHaveProperty([PROBLEM]);
    }
  });
});

describe('a station enabling catalog tools and skills (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let team: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const enabling = (tools: string[], skills: string[]) => {
    const delivery = definitionOf(BUILT_IN_LINES[0] as LineOpening);

    return {
      ...delivery,
      stations: delivery.stations.map((each, index) =>
        index === 1
          ? {
              ...each,
              tools: [...each.tools, ...tools],
              skills: [...each.skills, ...skills],
            }
          : each,
      ),
    };
  };

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    team = `enabling-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, team);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, seat.owner));
    await db
      .delete(schema.workspacePlan)
      .where(eq(schema.workspacePlan.workspaceId, team));
    await seat.unseat();
  });

  const onTheTeamPlan = () =>
    db.insert(schema.workspacePlan).values({ workspaceId: team, plan: 'team' });

  const created = (body: object) =>
    served(app)
      .post(`/api/v1/resources/teams/${team}/lines`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  it('rejects a line naming a catalog item the plan does not include, pointing at where it is named', async () => {
    const at = definitionOf(BUILT_IN_LINES[0] as LineOpening).stations[1]?.tools
      .length;
    const rejected = await created(enabling(['catalog.web-search@1.1.0'], []));

    expect(rejected.status).toBe(422);
    expect(rejected.body.errors).toEqual([
      expect.objectContaining({
        path: `stations[1].tools[${at}]`,
        message:
          'Catalog item catalog.web-search@1.1.0 requires the Team plan. Workspace plan: Free',
      }),
    ]);
  });

  it('rejects a line naming something the catalog does not have', async () => {
    await onTheTeamPlan();

    const rejected = await created(enabling([], ['catalog.research@9.0.0']));

    expect(rejected.status).toBe(422);
    expect(rejected.body.errors).toEqual([
      expect.objectContaining({
        path: 'stations[1].skills[0]',
        message: 'Catalog has no item catalog.research@9.0.0.',
      }),
    ]);
  });

  it('stores the versions it names, so an upgrade reads back as a change to the station', async () => {
    await onTheTeamPlan();
    const http = served(app);
    const made = await http
      .post(`/api/v1/resources/teams/${team}/lines`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(enabling(['catalog.web-search@1.0.0'], ['catalog.research@1.0.0']));

    expect(made.status).toBe(201);
    expect(made.body.definition.stations[1]).toMatchObject({
      tools: expect.arrayContaining(['catalog.web-search@1.0.0']),
      skills: expect.arrayContaining(['catalog.research@1.0.0']),
    });

    const upgraded = await http
      .put(`/api/v1/resources/lines/${made.body.id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', `"${made.body.version}"`)
      .send(enabling(['catalog.web-search@1.1.0'], ['catalog.research@1.0.0']));

    expect(upgraded.status).toBe(200);
    expect(upgraded.body.version).toBeGreaterThan(made.body.version);
    expect(upgraded.body.definition.stations[1].tools).toContain(
      'catalog.web-search@1.1.0',
    );
    expect(upgraded.body.definition.stations[1].tools).not.toContain(
      'catalog.web-search@1.0.0',
    );
  });

  it('rejects one catalog tool named at two versions, pointing at the station', async () => {
    const rejected = await served(app)
      .post(`/api/v1/resources/teams/${team}/lines`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send(
        enabling(['catalog.web-search@1.0.0', 'catalog.web-search@1.1.0'], []),
      );

    expect(rejected.status).toBe(422);
    expect(rejected.body.detail).toContain('catalog.web-search twice');
  });
});

describe('a catalog call (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  const workspace = `metered-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
    await db
      .insert(schema.workspacePlan)
      .values({ workspaceId: workspace, plan: 'team' });
  });

  afterAll(async () => {
    await db
      .delete(schema.catalogCall)
      .where(eq(schema.catalogCall.workspaceId, workspace));
    await db
      .delete(schema.workspacePlan)
      .where(eq(schema.workspacePlan.workspaceId, workspace));
    await app.close();
  });

  it('is metered, by workspace, run and the version called', async () => {
    const entitlements = new CatalogEntitlements(
      new StaticCatalog(CATALOG_ITEMS),
      new DrizzleWorkspacePlans(db),
      new DrizzleMeteredCalls(new DrizzleContext(db), {
        generate: () => randomUUID(),
      }),
      { call: async () => ['https://example.com'] },
      { now: () => new Date(), sleep: async () => {} },
    );
    const runId = randomUUID();

    await expect(
      entitlements.call({
        workspaceId: WorkspaceId.of(workspace),
        runId: RunId.of(runId),
        id: 'catalog.web-search@1.1.0',
        inputs: { query: 'queues' },
      }),
    ).resolves.toEqual({ kind: 'answered', output: ['https://example.com'] });

    const metered = await db
      .select()
      .from(schema.catalogCall)
      .where(eq(schema.catalogCall.workspaceId, workspace));

    expect(metered).toEqual([
      expect.objectContaining({
        runId,
        item: 'catalog.web-search@1.1.0',
        succeeded: true,
        billable: true,
      }),
    ]);
  });

  it('fails a run refused at dispatch, with its reason on record', async () => {
    const runs = new DrizzleRunRepository(
      new DrizzleContext(db),
      {
        dispatch: async () => {},
      },
      telemetryInMemory(),
    );
    const id = RunId.of(randomUUID());

    await runs.add(
      Run.enqueue({
        id,
        workspaceId: WorkspaceId.of(workspace),
        harness: HarnessId.of('dev'),
        spec: RunSpec.of({
          command: { executable: 'sh', args: [] },
          briefing: 'Search the web.',
          handover: { options: [], noteLimit: 0 },
          resume: { key: 'task:station' },
          catalog: ['catalog.web-search@1.1.0'],
        }),
      }).refused(
        RunOutcome.refused([
          DeniedCatalogItem.of({
            id: 'catalog.web-search@1.1.0',
            reason: 'expired',
            because:
              'Catalog item catalog.web-search@1.1.0 requires the Team plan. The workspace’s Team plan has expired. Expired at: 2026-09-01T00:00:00.000Z',
          }),
        ]),
      ),
    );

    const stored = await runs.findById(id);

    expect(stored?.state).toBe('failed');
    expect(stored?.outcome?.message).toMatch(/^entitlement_expired: /);
    expect(stored?.spec.value.catalog).toEqual(['catalog.web-search@1.1.0']);

    await db.delete(schema.run).where(eq(schema.run.id, id.value));
  });
});
