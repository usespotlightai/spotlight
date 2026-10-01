import { randomUUID } from 'node:crypto';
import {
  TEAM_HOLDINGS,
  type TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TEAM_DISBANDED } from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { and, eq, inArray, sql } from 'drizzle-orm';
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

const seated = async (app: INestApplication): Promise<ResourceFixture> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const held = `teams-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, held);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/workspaces/${held}/teams`,
    item: (id) => `/api/resources/teams/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${held}/teams/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) => `/api/resources/workspaces/${workspaceId}/teams`,
    workspaceOf: () => held,
    address: 'core',
    valid: { key: 'core', name: 'Core' },
    changed: { key: 'core', name: 'Core, again' },
    changedAgain: { key: 'core', name: 'Core, once more' },
    invalid: { body: { key: 'Core Team', name: 'Core' }, path: 'key' },
    close: async () => {
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

conformsAsResource({ kind: 'team', open: seated });

describe('a team, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: ResourceFixture;
  let workspaceId: string;

  const create = (body: object) =>
    served(app)
      .post(fixture.collection)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  const change = (id: string, version: number, body: object) =>
    served(app)
      .put(fixture.item(id))
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${version}"`)
      .send(body);

  const remove = (id: string, version: number) =>
    served(app)
      .delete(fixture.item(id))
      .set(TEST_USER_HEADER, fixture.admin)
      .set('If-Match', `"${version}"`);

  beforeAll(async () => {
    app = await openApp();
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

  it('opens bare, with none of the lines or the welcome a team made at sign-up gets', async () => {
    const made = await create(fixture.valid);
    const recorded = await app
      .get<DrizzleDatabase>(DRIZZLE)
      .select({ kind: schema.eventOutbox.kind })
      .from(schema.eventOutbox)
      .where(
        sql`${schema.eventOutbox.payload}::text like ${`%${made.body.id}%`}`,
      );

    expect(made.status).toBe(201);
    expect(recorded.map((each) => each.kind).sort()).toEqual([
      'identity.team-created.v1',
      'team.created',
    ]);
    expect(
      await app
        .get<DrizzleDatabase>(DRIZZLE)
        .select({ id: schema.line.id })
        .from(schema.line)
        .where(eq(schema.line.teamId, made.body.id)),
    ).toEqual([]);
  });

  it('counts whoever created it among its members', async () => {
    const made = await create(fixture.valid);

    expect(
      await app
        .get<DrizzleDatabase>(DRIZZLE)
        .select({ userId: schema.teamMember.userId })
        .from(schema.teamMember)
        .where(eq(schema.teamMember.teamId, made.body.id)),
    ).toEqual([{ userId: fixture.admin }]);
  });

  it('keeps the key it was created with', async () => {
    const made = await create(fixture.valid);
    const moved = await change(made.body.id, made.body.version, {
      key: 'platform',
      name: 'Core',
    });

    expect(moved.status).toBe(422);
    expect(moved.body.errors).toEqual([
      expect.objectContaining({ path: 'key' }),
    ]);
  });

  it('will not be deleted while it holds a line', async () => {
    const made = await create(fixture.valid);

    await app.get<DrizzleDatabase>(DRIZZLE).insert(schema.line).values({
      id: randomUUID(),
      workspaceId,
      teamId: made.body.id,
      key: 'delivery',
      name: 'Delivery',
    });

    const refused = await remove(made.body.id, made.body.version);

    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({
      type: 'urn:spotlight:problem:in-use',
      detail: expect.stringContaining('line delivery'),
    });

    await app
      .get<DrizzleDatabase>(DRIZZLE)
      .delete(schema.line)
      .where(
        and(
          eq(schema.line.teamId, made.body.id),
          eq(schema.line.key, 'delivery'),
        ),
      );
  });

  const holdEverything = async (teamId: string) => {
    let next = 0;

    await app.get(DrizzleLineRepository).add(
      Line.open({
        by: attributedIn(),
        workspaceId: WorkspaceId.of(workspaceId),
        teamId: TeamId.of(teamId),
        line: BUILT_IN_LINES[0] as LineOpening,
        newId: () => `${teamId}-${++next}`,
      }),
    );

    const db = app.get<DrizzleDatabase>(DRIZZLE);

    await db.insert(schema.skillDefinition).values({
      id: randomUUID(),
      teamId,
      key: 'grafana',
      files: { 'SKILL.md': '---\nname: grafana\ndescription: x\n---\nx' },
    });
    await db.insert(schema.integrationDefinition).values({
      id: randomUUID(),
      teamId,
      source: 'linear',
      definition: { integration: 'linear' },
      offers: [],
    });
    await db.insert(schema.harnessProfile).values({
      id: randomUUID(),
      teamId,
      key: 'careful',
      permissions: { allow: [], ask: ['execute'], deny: [] },
      mcpServers: [],
      native: {},
    });
  };

  const heldBy = async (teamId: string) => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);

    return [
      ...(await db
        .select({ key: schema.line.key })
        .from(schema.line)
        .where(eq(schema.line.teamId, teamId))),
      ...(await db
        .select({ key: schema.skillDefinition.key })
        .from(schema.skillDefinition)
        .where(eq(schema.skillDefinition.teamId, teamId))),
      ...(await db
        .select({ key: schema.integrationDefinition.source })
        .from(schema.integrationDefinition)
        .where(eq(schema.integrationDefinition.teamId, teamId))),
      ...(await db
        .select({ key: schema.harnessProfile.key })
        .from(schema.harnessProfile)
        .where(eq(schema.harnessProfile.teamId, teamId))),
    ];
  };

  const delivered = async (event: DomainEvent): Promise<void> => {
    for (const each of app.get(EventSubscribers).listeningTo(event.kind)) {
      for (const raised of await each.handle(event)) {
        await delivered(raised);
      }
    }
  };

  const abandon = (teamId: string) =>
    delivered({
      kind: TEAM_DISBANDED,
      workspaceId,
      teamId,
      key: 'core',
    } as DomainEvent);

  it('counts every kind of thing a team can hold, from every context', async () => {
    const teamId = randomUUID();

    await holdEverything(teamId);

    expect(
      await app.get<TeamHoldingsPort>(TEAM_HOLDINGS).of(TeamId.of(teamId)),
    ).toEqual(
      expect.arrayContaining([
        `line ${(BUILT_IN_LINES[0] as LineOpening).key.value}`,
        'skill grafana',
        'integration linear',
        'harness profile careful',
      ]),
    );

    await abandon(teamId);
  });

  it('abandons, in every context, whatever reached a team as it disbanded', async () => {
    const teamId = randomUUID();

    await holdEverything(teamId);
    await abandon(teamId);

    expect(
      app
        .get(EventSubscribers)
        .listeningTo(TEAM_DISBANDED)
        .map((each) => each.name)
        .sort(),
    ).toEqual([
      'configuration.abandon-harness-profiles-of-disbanded-team',
      'configuration.abandon-skills-of-disbanded-team',
      'integrations.abandon-integrations-of-disbanded-team',
      'outcomes.forget-alerts-of-disbanded-team',
      'outcomes.forget-chats-of-disbanded-team',
      'outcomes.forget-deliveries-of-disbanded-team',
      'outcomes.forget-failures-of-disbanded-team',
      'outcomes.forget-judgings-and-scores-of-disbanded-team',
      'outcomes.forget-pull-requests-of-disbanded-team',
      'outcomes.forget-runs-of-disbanded-team',
      'outcomes.forget-touches-of-disbanded-team',
      'work.abandon-lines-of-disbanded-team',
    ]);
    expect(await heldBy(teamId)).toEqual([]);
  });
});
