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

const JUDGE = {
  rubric: 'A good run changes only what the task requests.\n',
  sample: 0.2,
  minAgreement: 0.6,
};

const ALERTS = [
  { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
  { measure: 'cost_per_run', above: 5, over: 10 },
  { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
  { measure: 'merged_rate', below: 0.4, over: 20 },
];

const judged = (
  judge: object | undefined,
  alerts: readonly object[],
  at = 1,
) => ({
  ...DELIVERY,
  stations: DELIVERY.stations.map((each, place) =>
    place === at ? { ...each, ...(judge ? { judge } : {}), alerts } : each,
  ),
});

const seated = async (
  app: INestApplication,
): Promise<ResourceFixture & { readonly workspaceId: string }> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `lines-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);

  return {
    workspaceId,
    admin: seat.owner,
    viewer: seat.member,
    collection: `/api/resources/teams/${workspaceId}/lines`,
    item: (id) => `/api/resources/lines/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/lines/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) => `/api/resources/workspaces/${workspaceId}/lines`,
    workspaceOf: () => workspaceId,
    address: `team/${DELIVERY.key}`,
    valid: judged(JUDGE, ALERTS),
    changed: {
      ...judged({ ...JUDGE, sample: 0.5 }, [...ALERTS].reverse()),
      name: 'Delivery, again',
    },
    changedAgain: { ...judged(undefined, []), name: 'Delivery, once more' },
    invalid: {
      body: judged({ ...JUDGE, sample: 1.5 }, ALERTS),
      path: 'stations[1].judge.sample',
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

  const putTaskAt = async (lineId: string, key: string) => {
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
      openedFrom: 'person',
      workspaceId: station?.workspaceId ?? '',
      stationId: station?.id ?? '',
      title: 'Wait here',
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

  it('reads back as it is now, with every optional field filled in', async () => {
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
        'memories',
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

  it('stores a prompt exactly as written, so applying it again reads back the same', async () => {
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

  it('keeps a station remembering its runs, and clears it once told to stop', async () => {
    const remembering = (memories: boolean) => ({
      ...DELIVERY,
      stations: DELIVERY.stations.map((each, at) =>
        at === 1 ? { ...each, memories } : each,
      ),
    });
    const made = await create(remembering(true));
    const stopped = await change(
      made.body.id,
      made.body.version,
      remembering(false),
    );

    expect(made.status).toBe(201);
    expect(made.body.definition.stations[1].memories).toBe(true);
    expect(made.body.definition.stations[0].memories).toBe(false);
    expect(stopped.status).toBe(200);
    expect(stopped.body.definition.stations[1].memories).toBe(false);
  });

  it('stores a station’s judge and its alerts as written, in their order, and clears them once left out', async () => {
    const made = await create(judged(JUDGE, ALERTS));
    const again = await change(
      made.body.id,
      made.body.version,
      judged(JUDGE, ALERTS),
    );
    const cleared = await change(
      made.body.id,
      again.body.version,
      judged(undefined, []),
    );

    expect(made.status).toBe(201);
    expect(made.body.definition.stations[1].judge).toEqual(JUDGE);
    expect(made.body.definition.stations[1].alerts).toEqual(ALERTS);
    expect(made.body.definition.stations[0]).not.toHaveProperty('judge');
    expect(made.body.definition.stations[0].alerts).toEqual([]);
    expect(again.status).toBe(200);
    expect(again.body.definition).toEqual(made.body.definition);
    expect(cleared.status).toBe(200);
    expect(cleared.body.definition.stations[1]).not.toHaveProperty('judge');
    expect(cleared.body.definition.stations[1].alerts).toEqual([]);
  });

  it('rejects a wrong alert at its field, an alert repeating one before it, a rubric whose scale it cannot read, and a judge or alerts where nothing runs', async () => {
    const wrongAlert = await create(
      judged(JUDGE, [
        ALERTS[0] as object,
        { measure: 'merged_rate', below: 1.5, over: 20 },
      ]),
    );
    const neither = await create(
      judged(JUDGE, [{ measure: 'failed_rate', over: 5 }]),
    );
    const several = await create(
      judged(JUDGE, [
        ALERTS[0] as object,
        { measure: 'cost_per_run', risesBy: 1, below: 5, over: 10 },
      ]),
    );
    const twice = await create(
      judged(JUDGE, [
        ALERTS[1] as object,
        ALERTS[0] as object,
        { measure: 'cost_per_run', above: 9, over: 5 },
      ]),
    );
    const atBacklog = await create(judged(JUDGE, [], 0));
    const unknownScale = await create(
      judged({ ...JUDGE, rubric: 'scores: 1-10\nHow good is it?' }, []),
    );
    const atCompleted = await create(
      judged(undefined, ALERTS, DELIVERY.stations.length - 1),
    );

    for (const [rejected, path] of [
      [wrongAlert, 'stations[1].alerts[1].below'],
      [neither, 'stations[1].alerts[0]'],
      [several, 'stations[1].alerts[1]'],
      [twice, 'stations[1].alerts[2]'],
      [atBacklog, 'stations[0].judge'],
      [unknownScale, 'stations[1].judge.rubric'],
      [atCompleted, `stations[${DELIVERY.stations.length - 1}].alerts`],
    ] as const) {
      expect(rejected.status).toBe(422);
      expect(rejected.body.errors).toEqual([expect.objectContaining({ path })]);
    }
  });

  it('stores a judge of checkable claims, with or without a rubric, and the pass threshold of claims a run must meet', async () => {
    const claims = [
      'The change adds a test that fails without it.',
      'The change touches only the files the task names.',
    ];
    const alone = await create(
      judged(
        { claims, passThreshold: 0.5, sample: 0.2, minAgreement: 0.6 },
        [],
      ),
    );
    const both = await change(
      alone.body.id,
      alone.body.version,
      judged({ ...JUDGE, claims, passThreshold: 1 }, []),
    );

    expect(alone.status).toBe(201);
    expect(alone.body.definition.stations[1].judge).toEqual({
      claims,
      passThreshold: 0.5,
      sample: 0.2,
      minAgreement: 0.6,
    });
    expect(both.status).toBe(200);
    expect(both.body.definition.stations[1].judge).toEqual({
      ...JUDGE,
      claims,
      passThreshold: 1,
    });
  });

  it('rejects a judge with neither a rubric nor claims, too many or too long claims, a pass threshold out of bounds, and a pass threshold without claims', async () => {
    const claims = ['The change adds a test.'];
    const neither = await create(
      judged({ sample: 0.2, minAgreement: 0.6 }, []),
    );
    const none = await create(
      judged({ claims: [], sample: 0.2, minAgreement: 0.6 }, []),
    );
    const tooMany = await create(
      judged(
        {
          claims: Array.from({ length: 21 }, (_, at) => `Claim ${at}.`),
          sample: 0.2,
          minAgreement: 0.6,
        },
        [],
      ),
    );
    const tooLong = await create(
      judged({ claims: ['x'.repeat(501)], sample: 0.2, minAgreement: 0.6 }, []),
    );
    const blank = await create(
      judged({ claims: ['  '], sample: 0.2, minAgreement: 0.6 }, []),
    );
    const badThreshold = await create(
      judged(
        { claims, passThreshold: 1.5, sample: 0.2, minAgreement: 0.6 },
        [],
      ),
    );
    const thresholdAlone = await create(
      judged({ ...JUDGE, passThreshold: 0.5 }, []),
    );

    for (const [rejected, path] of [
      [neither, 'stations[1].judge.rubric'],
      [none, 'stations[1].judge.claims'],
      [tooMany, 'stations[1].judge.claims'],
      [tooLong, 'stations[1].judge.claims'],
      [blank, 'stations[1].judge.claims'],
      [badThreshold, 'stations[1].judge.passThreshold'],
      [thresholdAlone, 'stations[1].judge.passThreshold'],
    ] as const) {
      expect(rejected.status).toBe(422);
      expect(rejected.body.errors).toEqual([expect.objectContaining({ path })]);
    }
  });

  it('stores the threshold a planned change is checked against, filling in what it leaves out, and clears it once left out', async () => {
    const made = await create({
      ...DELIVERY,
      replayCheck: { maxRegressions: 1, currency: 'eur' },
    });
    const cleared = await change(made.body.id, made.body.version, DELIVERY);

    expect(made.status).toBe(201);
    expect(made.body.definition.replayCheck).toEqual({
      maxRegressions: 1,
      ceiling: 10,
      currency: 'EUR',
      minGain: 0.05,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.definition).not.toHaveProperty('replayCheck');
  });

  it('rejects a threshold setting at its field', async () => {
    for (const [replayCheck, path] of [
      [{ maxRegressions: -1 }, 'replayCheck.maxRegressions'],
      [{ ceiling: 0 }, 'replayCheck.ceiling'],
      [{ currency: 'dollars' }, 'replayCheck.currency'],
      [{ minGain: 0 }, 'replayCheck.minGain'],
      [{ minGain: 1.5 }, 'replayCheck.minGain'],
    ] as const) {
      const rejected = await create({ ...DELIVERY, replayCheck });

      expect(rejected.status).toBe(422);
      expect(rejected.body.errors).toEqual([expect.objectContaining({ path })]);
    }
  });

  it('rejects a station’s harness, model or name at its field', async () => {
    for (const [setting, path] of [
      [{ harness: 'h'.repeat(61) }, 'stations[1].harness'],
      [{ model: 'm'.repeat(61) }, 'stations[1].model'],
      [{ name: '   ' }, 'stations[1].name'],
    ] as const) {
      const rejected = await create({
        ...DELIVERY,
        stations: DELIVERY.stations.map((each, place) =>
          place === 1 ? { ...each, ...setting } : each,
        ),
      });

      expect(rejected.status).toBe(422);
      expect(rejected.body.errors).toEqual([expect.objectContaining({ path })]);
    }
  });

  it('stores where the line’s Terraform lives, shows it on the team’s lines, and clears it once set to null', async () => {
    const source = {
      repository: 'acme/platform',
      path: 'teams/core/delivery.tf',
    };
    const made = await create({ ...DELIVERY, source });
    const teamId = fixture.collection.split('/')[4];
    const listed = await served(app)
      .get(`/api/teams/${teamId}/lines`)
      .set(TEST_USER_HEADER, fixture.admin);
    const cleared = await change(made.body.id, made.body.version, {
      ...DELIVERY,
      source: null,
    });

    expect(made.status).toBe(201);
    expect(made.body.definition.source).toEqual(source);
    expect(
      (listed.body as { id: string; source: unknown }[]).find(
        (each) => each.id === made.body.id,
      )?.source,
    ).toEqual(source);
    expect(cleared.status).toBe(200);
    expect(cleared.body.definition).not.toHaveProperty('source');
  });

  it('rejects a source setting at its field', async () => {
    for (const [source, path] of [
      [{ repository: 'platform', path: 'main.tf' }, 'source.repository'],
      [{ repository: 'acme/platform', path: '../main.tf' }, 'source.path'],
      [{ repository: 'acme/platform', path: 'main.hcl' }, 'source.path'],
    ] as const) {
      const rejected = await create({ ...DELIVERY, source });

      expect(rejected.status).toBe(422);
      expect(rejected.body.errors).toEqual([expect.objectContaining({ path })]);
    }
  });

  it('stores the image and setup each repository names, and reads them back as written', async () => {
    const written = {
      ...DELIVERY,
      repositories: [
        { name: 'acme/web', setup: 'pnpm install\n' },
        { name: 'acme/api', image: 'ghcr.io/acme/app:1', setup: 'npm ci' },
      ],
    };
    const made = await create(written);

    expect(made.status).toBe(201);
    expect(made.body.definition.repositories).toEqual([
      { name: 'acme/api', image: 'ghcr.io/acme/app:1', setup: 'npm ci' },
      { name: 'acme/web', setup: 'pnpm install\n' },
    ]);

    const again = await change(made.body.id, made.body.version, written);

    expect(again.status).toBe(200);
    expect(again.body.definition).toEqual(made.body.definition);
  });

  it('rejects repositories naming different images, and a station checking its layers while a repository says no setup', async () => {
    const mixed = await create({
      ...DELIVERY,
      repositories: [
        { name: 'acme/api', image: 'ghcr.io/acme/api:1' },
        { name: 'acme/web', image: 'ghcr.io/acme/web:1' },
      ],
    });
    const unready = await create({
      ...DELIVERY,
      repositories: [
        { name: 'acme/api', setup: 'npm ci' },
        { name: 'acme/web' },
      ],
      stations: DELIVERY.stations.map((each, at) =>
        at === 1 ? { ...each, check: 'npm test', diffs: true } : each,
      ),
    });

    expect(mixed.status).toBe(422);
    expect(mixed.body.errors).toEqual([
      expect.objectContaining({ path: 'repositories' }),
    ]);
    expect(unready.status).toBe(422);
    expect(unready.body.errors).toEqual([
      expect.objectContaining({ path: 'repositories[1].setup' }),
    ]);
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

  it('will not be deleted, or drop a station, while a task is at it', async () => {
    const made = await create(DELIVERY);
    const going = DELIVERY.stations[1]?.key as string;

    await putTaskAt(made.body.id, going);

    const cleared = await change(made.body.id, made.body.version, {
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

    for (const rejected of [cleared, deleted]) {
      expect(rejected.status).toBe(409);
      expect(rejected.body).toMatchObject({
        type: 'urn:spotlight:problem:in-use',
        detail: expect.stringContaining('(1)'),
      });
    }
  });

  it('limits a role to one line per team even past the check before writing', async () => {
    const lines = app.get(DrizzleLineRepository);
    const teamId = fixture.workspaceId;
    const opening = BUILT_IN_LINES.find((each) => each.role) as LineOpening;
    let next = 0;
    const newLine = (key: string) =>
      Line.create({
        by: attributedIn(),
        workspaceId: WorkspaceId.of(teamId),
        teamId: TeamId.of(teamId),
        line: { ...opening, key: LineKey.of(key) },
        newId: () => `${teamId}-${key}-${++next}`,
      });

    await lines.add(newLine('first'));

    await expect(lines.add(newLine('second'))).rejects.toThrow(
      LineRoleTakenError,
    );
  });

  it('lists every line across the workspace’s teams in address order, each as its read answers it', async () => {
    const db = app.get<DrizzleDatabase>(DRIZZLE);
    const workspaceId = fixture.workspaceId;
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
    const workspaceId = fixture.workspaceId;
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
              repositories: [{ name: 'acme/api' }, { name: 'acme/web' }],
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
            (each: { definition: { repositories: { name: string }[] } }) =>
              each.definition.repositories,
          ),
      ).toEqual(
        definitions.map(() => [{ name: 'acme/api' }, { name: 'acme/web' }]),
      );
    } finally {
      await db.delete(schema.line).where(eq(schema.line.teamId, alpha.body.id));
    }
  });
});
