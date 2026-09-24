import { randomUUID } from 'node:crypto';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
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

const LINEAR = {
  integration: 'linear',
  name: 'Linear',
  actions: {
    comment: {
      request: { method: 'POST', url: 'https://api.linear.app/graphql' },
    },
  },
  tools: {
    comment: { description: 'Comment on an issue', does: 'comment' },
  },
};

const WITHOUT_TOOLS = { ...LINEAR, tools: {} };

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const held = `integrations-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, held);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${held}/integrations`,
    item: (id) => `/api/resources/integrations/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${held}/integrations/import?address=${encodeURIComponent(address)}`,
    address: 'team/linear',
    valid: LINEAR,
    changed: { ...LINEAR, name: 'Linear, again' },
    changedAgain: { ...LINEAR, name: 'Linear, once more' },
    invalid: {
      body: {
        ...LINEAR,
        actions: { comment: { request: { method: 'POST' } } },
      },
      path: 'actions.comment.request.url',
    },
    close: async () => {
      await db
        .delete(schema.integrationDefinition)
        .where(eq(schema.integrationDefinition.teamId, held));
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

conformsAsResource({ kind: 'integration', open: seated });

describe('an integration, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;
  let teamId: string;

  const as = () => ({
    put: (id: string, version: number, body: unknown) =>
      served(app)
        .put(fixture.item(id))
        .set(TEST_USER_HEADER, fixture.admin)
        .set('If-Match', `"${version}"`)
        .send(body as object),
    delete: (id: string, version: number) =>
      served(app)
        .delete(fixture.item(id))
        .set(TEST_USER_HEADER, fixture.admin)
        .set('If-Match', `"${version}"`),
  });

  const giveOnAStation = async (tool: string) => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const [team] = await db
      .select()
      .from(schema.team)
      .where(eq(schema.team.id, teamId));
    const lineId = randomUUID();
    const stationId = randomUUID();

    await db.insert(schema.line).values({
      id: lineId,
      workspaceId: team?.workspaceId ?? '',
      teamId,
      key: 'delivery',
      name: 'Delivery',
    });
    await db.insert(schema.station).values({
      id: stationId,
      lineId,
      key: 'implementation',
      name: 'Implementation',
      position: 0,
    });
    await db
      .insert(schema.stationTool)
      .values({ stationId, tool, position: 0 });
  };

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
    teamId = fixture.collection.split('/')[4] ?? '';
  });

  afterEach(async () => {
    await fixture.close();
  });

  it('is what the team is configured with from then on', async () => {
    const made = await create(LINEAR);
    const teamId = TeamId.of(made.body.teamId);

    expect(made.status).toBe(201);
    expect(
      await app
        .get<DefinedIntegrationsPort>(DEFINED_INTEGRATIONS)
        .ofTeam(teamId),
    ).toEqual([
      expect.objectContaining({
        source: 'linear',
        definition: expect.objectContaining({ name: 'Linear' }),
      }),
    ]);
    expect(
      (
        await app.get<TeamIntegrationsPort>(TEAM_INTEGRATIONS).offered(teamId)
      ).map((each) => each.tool),
    ).toEqual(['linear.comment']);
  });

  it('keeps the host it was created for', async () => {
    const made = await create(LINEAR);
    const moved = await served(app)
      .put(fixture.item(made.body.id))
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${made.body.version}"`)
      .send({ ...LINEAR, integration: 'slack' });

    expect(moved.status).toBe(422);
    expect(moved.body.errors).toEqual([
      expect.objectContaining({ path: 'integration' }),
    ]);
  });

  it('will not be deleted, or stop offering a tool, while a station gives it', async () => {
    const made = await create(LINEAR);

    await giveOnAStation('linear.comment');

    const stripped = await as().put(
      made.body.id,
      made.body.version,
      WITHOUT_TOOLS,
    );
    const deleted = await as().delete(made.body.id, made.body.version);

    for (const refused of [stripped, deleted]) {
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({
        type: 'urn:spotlight:problem:in-use',
        detail: expect.stringContaining('delivery/implementation'),
      });
    }
  });
});
