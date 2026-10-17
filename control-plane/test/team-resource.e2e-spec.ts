import { randomUUID } from 'node:crypto';
import {
  TEAM_DEPENDENTS,
  type TeamDependentsPort,
} from '@identity/application/ports/team-dependents.port';
import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TEAM_DELETED } from '@shared-kernel/application/integration-events/team-deleted.integration-event';
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
  const workspaceId = `teams-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  return {
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/workspaces/${workspaceId}/teams`,
    item: (id) => `/api/resources/teams/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/teams/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) => `/api/resources/workspaces/${workspaceId}/teams`,
    workspaceOf: () => workspaceId,
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

  it('is created bare, with none of the lines or the welcome a team made at sign-up gets', async () => {
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

  it('will not be deleted while it has a line', async () => {
    const made = await create(fixture.valid);

    await app.get<DrizzleDatabase>(DRIZZLE).insert(schema.line).values({
      id: randomUUID(),
      workspaceId,
      teamId: made.body.id,
      key: 'delivery',
      name: 'Delivery',
    });

    const rejected = await remove(made.body.id, made.body.version);

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({
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

  const addEveryDependent = async (teamId: string) => {
    let next = 0;

    await app.get(DrizzleLineRepository).add(
      Line.create({
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
      integration: 'linear',
      definition: { integration: 'linear' },
      tools: [],
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

  const dependentsOf = async (teamId: string) => {
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
        .select({ key: schema.integrationDefinition.integration })
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

  const deleteTeam = (teamId: string) =>
    delivered({
      kind: TEAM_DELETED,
      workspaceId,
      teamId,
      key: 'core',
    } as DomainEvent);

  it('counts every kind of dependent a team can have, from every context', async () => {
    const teamId = randomUUID();

    await addEveryDependent(teamId);

    expect(
      await app.get<TeamDependentsPort>(TEAM_DEPENDENTS).of(TeamId.of(teamId)),
    ).toEqual(
      expect.arrayContaining([
        `line ${(BUILT_IN_LINES[0] as LineOpening).key.value}`,
        'skill grafana',
        'integration linear',
        'harness profile careful',
      ]),
    );

    await deleteTeam(teamId);
  });

  it('deletes, in every context, whatever arrived for a team as it was deleted', async () => {
    const teamId = randomUUID();

    await addEveryDependent(teamId);
    await deleteTeam(teamId);

    expect(
      app
        .get(EventSubscribers)
        .listeningTo(TEAM_DELETED)
        .map((each) => each.name)
        .sort(),
    ).toEqual([
      'configuration.delete-harness-profiles-of-deleted-team',
      'configuration.delete-skills-of-deleted-team',
      'integrations.delete-connections-of-deleted-team',
      'integrations.delete-integrations-of-deleted-team',
      'outcomes.delete-alerts-of-deleted-team',
      'outcomes.delete-chats-of-deleted-team',
      'outcomes.delete-config-pull-requests-of-deleted-team',
      'outcomes.delete-deliveries-of-deleted-team',
      'outcomes.delete-failures-of-deleted-team',
      'outcomes.delete-judgings-and-scores-of-deleted-team',
      'outcomes.delete-pull-requests-of-deleted-team',
      'outcomes.delete-runs-of-deleted-team',
      'outcomes.delete-touches-of-deleted-team',
      'replays.delete-config-pull-requests-of-deleted-team',
      'replays.delete-replay-checks-of-deleted-team',
      'replays.delete-replays-of-deleted-team',
      'replays.delete-searches-of-deleted-team',
      'work.delete-lines-of-deleted-team',
      'work.delete-notices-of-deleted-team',
    ]);
    expect(await dependentsOf(teamId)).toEqual([]);
  });
});
