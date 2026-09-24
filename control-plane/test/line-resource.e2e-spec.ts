import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { and, eq, inArray } from 'drizzle-orm';
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
import {
  conformsAsResource,
  type ResourceFixture,
} from './support/resource-conformance';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const DELIVERY = definitionOf(BUILT_IN_LINES[0] as LineOpening);

const seated = async (
  app: INestApplication,
): Promise<ResourceFixture & { readonly held: string }> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const held = `lines-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, held);

  return {
    held,
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${held}/lines`,
    item: (id) => `/api/resources/lines/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${held}/lines/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) => `/api/resources/workspaces/${workspaceId}/lines`,
    workspaceOf: () => held,
    address: `team/${DELIVERY.key}`,
    valid: DELIVERY,
    changed: { ...DELIVERY, name: 'Delivery, again' },
    changedAgain: { ...DELIVERY, name: 'Delivery, once more' },
    invalid: { body: { ...DELIVERY, stations: [] }, path: 'stations' },
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

conformsAsResource({ kind: 'line', open: seated });

describe('a line, created through the resource API (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof seated>>;

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

  const standOn = async (lineId: string, key: string) => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const [station] = await db
      .select({ id: schema.station.id, workspaceId: schema.line.workspaceId })
      .from(schema.station)
      .innerJoin(schema.line, eq(schema.line.id, schema.station.lineId))
      .where(
        and(eq(schema.station.lineId, lineId), eq(schema.station.key, key)),
      );

    await db.insert(schema.task).values({
      id: randomUUID(),
      workspaceId: station?.workspaceId ?? '',
      stationId: station?.id ?? '',
      title: 'Stand here',
    });
  };

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

  it('reads back as it stands, every field a definition may leave out filled in', async () => {
    const made = await create(DELIVERY);
    const [station] = made.body.definition.stations;

    expect(made.body).toMatchObject({
      key: DELIVERY.key,
      definition: { key: DELIVERY.key, name: DELIVERY.name },
    });
    expect(Object.keys(station).sort()).toEqual(
      expect.arrayContaining([
        'color',
        'decisions',
        'diffs',
        'ends',
        'key',
        'kind',
        'name',
        'passesTo',
        'skills',
        'tools',
      ]),
    );
  });

  it('keeps a prompt exactly as written, so applying it again reads back the same', async () => {
    const written = {
      ...DELIVERY,
      stations: DELIVERY.stations.map((each, at) =>
        at === 1 ? { ...each, prompt: 'Implement the task.\n' } : each,
      ),
    };
    const made = await create(written);
    const read = await served(app)
      .get(fixture.item(made.body.id))
      .set(TEST_USER_HEADER, fixture.admin);
    const again = await change(made.body.id, made.body.version, written);

    expect(made.status).toBe(201);
    expect(read.body.definition.stations[1].prompt).toBe(
      'Implement the task.\n',
    );
    expect(again.status).toBe(200);
    expect(again.body.definition).toEqual(read.body.definition);
  });

  it('keeps the key it was created with', async () => {
    const made = await create(DELIVERY);
    const moved = await change(made.body.id, made.body.version, {
      ...DELIVERY,
      key: 'shipping',
    });

    expect(moved.status).toBe(422);
    expect(moved.body.errors).toEqual([
      expect.objectContaining({ path: 'key' }),
    ]);
  });

  it('will not be deleted, or drop a station, while a task stands on it', async () => {
    const made = await create(DELIVERY);
    const going = DELIVERY.stations[1]?.key as string;

    await standOn(made.body.id, going);

    const dropped = await change(made.body.id, made.body.version, {
      ...DELIVERY,
      stations: DELIVERY.stations
        .filter((each) => each.key !== going)
        .map((each) => ({
          ...each,
          passesTo: each.passesTo.filter((to) => to !== going),
        })),
      reactions: DELIVERY.reactions.filter((each) => each.to !== going),
    });
    const deleted = await remove(made.body.id, made.body.version);

    for (const refused of [dropped, deleted]) {
      expect(refused.status).toBe(409);
      expect(refused.body).toMatchObject({
        type: 'urn:spotlight:problem:in-use',
        detail: expect.stringContaining('1 standing there'),
      });
    }
  });

  it('holds a role to one line per team even past the check before writing', async () => {
    const lines = app.get(DrizzleLineRepository);
    const teamId = fixture.held;
    const opening = BUILT_IN_LINES.find((each) => each.role) as LineOpening;
    let next = 0;
    const opened = (key: string) =>
      Line.open({
        by: attributedIn(),
        workspaceId: WorkspaceId.of(teamId),
        teamId: TeamId.of(teamId),
        line: { ...opening, key: LineKey.of(key) },
        newId: () => `${teamId}-${key}-${++next}`,
      });

    await lines.add(opened('first'));

    await expect(lines.add(opened('second'))).rejects.toThrow(
      LineRoleTakenError,
    );
  });

  it('lists every line across the workspace’s teams in address order, each as its read answers it', async () => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const workspaceId = fixture.held;
    const alpha = await served(app)
      .post(`/api/resources/workspaces/${workspaceId}/teams`)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'alpha', name: 'Alpha' });

    expect(alpha.status).toBe(201);

    try {
      const onTeam = await create(DELIVERY);
      const onAlpha = await served(app)
        .post(`/api/resources/teams/${alpha.body.id}/lines`)
        .set(TEST_USER_HEADER, fixture.admin)
        .set('Idempotency-Key', randomUUID())
        .send(DELIVERY);
      const listed = await served(app)
        .get(fixture.listing(workspaceId))
        .set(TEST_USER_HEADER, fixture.viewer);

      expect(listed.status).toBe(200);
      expect(listed.body).toEqual({ items: [onAlpha.body, onTeam.body] });
      expect(
        listed.body.items.map((each: { address: string }) => each.address),
      ).toEqual([`alpha/${DELIVERY.key}`, `team/${DELIVERY.key}`]);
    } finally {
      await db.delete(schema.line).where(eq(schema.line.teamId, alpha.body.id));
    }
  });

  it('reads several lines across teams at once, each exactly as it reads alone', async () => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const workspaceId = fixture.held;
    const alpha = await served(app)
      .post(`/api/resources/workspaces/${workspaceId}/teams`)
      .set(TEST_USER_HEADER, fixture.admin)
      .set('Idempotency-Key', randomUUID())
      .send({ key: 'alpha', name: 'Alpha' });

    expect(alpha.status).toBe(201);

    try {
      const definitions = BUILT_IN_LINES.map((each) => definitionOf(each));
      const onTeam = await Promise.all(definitions.map((each) => create(each)));
      const onAlpha = await Promise.all(
        definitions.map((each) =>
          served(app)
            .post(`/api/resources/teams/${alpha.body.id}/lines`)
            .set(TEST_USER_HEADER, fixture.admin)
            .set('Idempotency-Key', randomUUID())
            .send({
              ...each,
              repositories: ['acme/api', 'acme/web'],
              stations: each.stations.map((station, at) =>
                at === 0
                  ? { ...station, skills: ['grafana', 'runbooks'] }
                  : station,
              ),
            }),
        ),
      );

      expect([...onTeam, ...onAlpha].map((each) => each.status)).toEqual(
        [...onTeam, ...onAlpha].map(() => 201),
      );

      const alone = await Promise.all(
        [...onTeam, ...onAlpha].map((each) =>
          served(app)
            .get(fixture.item(each.body.id))
            .set(TEST_USER_HEADER, fixture.viewer),
        ),
      );
      const listed = await served(app)
        .get(fixture.listing(workspaceId))
        .set(TEST_USER_HEADER, fixture.viewer);

      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(alone.length);
      expect(
        [...listed.body.items].sort(
          (one: { id: string }, other: { id: string }) =>
            one.id.localeCompare(other.id),
        ),
      ).toEqual(
        alone
          .map((each) => each.body)
          .sort((one, other) => one.id.localeCompare(other.id)),
      );
      expect(
        listed.body.items
          .filter((each: { address: string }) =>
            each.address.startsWith('alpha/'),
          )
          .map(
            (each: { definition: { repositories: string[] } }) =>
              each.definition.repositories,
          ),
      ).toEqual(definitions.map(() => ['acme/api', 'acme/web']));
    } finally {
      await db.delete(schema.line).where(eq(schema.line.teamId, alpha.body.id));
    }
  });
});
