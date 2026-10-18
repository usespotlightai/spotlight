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

const TOKEN_HEADER = 'spotlight-workspace-token';

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  repositories: [{ name: 'acme/api' }],
  stations: [
    {
      key: 'backlog',
      name: 'Backlog',
      kind: 'backlog',
      passesTo: ['build'],
    },
    {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it.',
      passesTo: ['ship'],
    },
    {
      key: 'ship',
      name: 'Ship',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Ship it.',
      ends: true,
    },
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
};

type Block = Record<string, unknown>;

interface Seated extends ResourceFixture {
  readonly workspaceId: string;
  readonly lineId: string;
  readonly live: Block;
  readonly tokenWith: (scopes: readonly string[]) => Promise<string>;
}

const proposal = (live: Block, name: string, prompt: string) => ({
  name,
  station: { ...live, prompt },
});

const seated = async (app: INestApplication): Promise<Seated> => {
  const db = app.get<DrizzleDatabase>(DRIZZLE);
  const workspaceId = `candidates-${randomUUID().slice(0, 8)}`;
  const seat = await seatTeam(db, workspaceId);
  const created = await served(app)
    .post(`/api/resources/teams/${workspaceId}/lines`)
    .set(TEST_USER_HEADER, seat.owner)
    .set('Idempotency-Key', randomUUID())
    .send(DELIVERY);

  expect(created.status).toBe(201);

  const lineId = created.body.id as string;
  const live = (created.body.definition.stations as { key: string }[]).find(
    (each) => each.key === 'build',
  ) as Block;
  const tokenWith = async (scopes: readonly string[]) => {
    const issued = await served(app)
      .post(`/api/resources/workspaces/${workspaceId}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: `candidates-${randomUUID().slice(0, 8)}`, scopes });

    expect(issued.status).toBe(201);

    return issued.headers[TOKEN_HEADER] as string;
  };

  return {
    workspaceId,
    lineId,
    live,
    tokenWith,
    admin: seat.owner,
    viewer: seat.member,
    viewerToken: await tokenWith(['read']),
    collection: `/api/resources/lines/${lineId}/stations/build/replay-candidates`,
    item: (id) => `/api/resources/replay-candidates/${id}`,
    importing: (address) =>
      `/api/resources/workspaces/${workspaceId}/replay-candidates/import?address=${encodeURIComponent(address)}`,
    listing: (workspaceId) =>
      `/api/resources/workspaces/${workspaceId}/replay-candidates`,
    workspaceOf: () => workspaceId,
    address: 'team/delivery/build/Shorter prompt',
    valid: proposal(live, 'Shorter prompt', 'Build it, briefly.'),
    changed: proposal(live, 'Longer prompt', 'Build it, and say why.'),
    changedAgain: proposal(live, 'Other prompt', 'Build it again.'),
    invalid: {
      body: { name: 'Unstartable', station: { ...live, harness: 'nope' } },
      path: 'station.harness',
    },
    close: async () => {
      await db
        .delete(schema.replay)
        .where(eq(schema.replay.workspaceId, workspaceId));
      await db
        .delete(schema.replayCandidate)
        .where(eq(schema.replayCandidate.workspaceId, workspaceId));
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
      await seat.unseat();
    },
  };
};

conformsAsResource({
  kind: 'replay-candidate',
  open: seated,
  operations: ['create', 'read', 'delete', 'import', 'list'],
});

describe('a replay candidate, proposed through the resource API (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let fixture: Seated;

  const as = (user: string) => ({
    post: (path: string, body: object, key = randomUUID()) =>
      served(app)
        .post(path)
        .set(TEST_USER_HEADER, user)
        .set('Idempotency-Key', key)
        .send(body),
    get: (path: string) => served(app).get(path).set(TEST_USER_HEADER, user),
    delete: (path: string, version: number) =>
      served(app)
        .delete(path)
        .set(TEST_USER_HEADER, user)
        .set('If-Match', `"${version}"`),
  });

  const bearing = (token: string) => ({
    post: (path: string, body: object) =>
      served(app)
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', 'cli/0.4.2')
        .set('Idempotency-Key', randomUUID())
        .send(body),
    get: (path: string) =>
      served(app).get(path).set('Authorization', `Bearer ${token}`),
    delete: (path: string, version: number) =>
      served(app)
        .delete(path)
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', 'cli/0.4.2')
        .set('If-Match', `"${version}"`),
  });

  const owner = () => as(fixture.admin);

  const proposed = async (name: string, prompt: string) => {
    const answer = await owner().post(
      fixture.collection,
      proposal(fixture.live, name, prompt),
    );

    expect(answer.status).toBe(201);

    return answer.body as {
      id: string;
      version: number;
      stationId: string;
      fingerprint: string;
    };
  };

  const pathsOf = (answer: { body: { errors?: { path: string }[] } }) =>
    (answer.body.errors ?? []).map((each) => each.path);

  beforeAll(async () => {
    app = await openApp();
    db = app.get(DRIZZLE);
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

  it('is proposed by a token that may plan, forbidden to one that may only read, and unseen from another workspace', async () => {
    const planner = await fixture.tokenWith(['plan']);
    const reader = await fixture.tokenWith(['read']);
    const body = proposal(fixture.live, 'Planned', 'Build it, planned.');

    const forbidden = await bearing(reader).post(fixture.collection, body);

    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({
      type: 'urn:spotlight:problem:forbidden',
      permission: 'plan',
    });

    const made = await bearing(planner).post(fixture.collection, body);

    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({
      address: 'team/delivery/build/Planned',
      stationPath: 'team/delivery/build',
      kind: 'proposed',
      lineId: fixture.lineId,
    });
    expect(
      (await bearing(reader).get(fixture.item(made.body.id))).body,
    ).toEqual(made.body);

    const elsewhere = await seated(app);

    try {
      const stranger = await elsewhere.tokenWith(['plan']);

      expect(
        (await bearing(stranger).get(fixture.item(made.body.id))).status,
      ).toBe(404);
      expect(
        (await bearing(stranger).post(fixture.collection, body)).status,
      ).toBe(404);
      expect(
        (await bearing(stranger).delete(fixture.item(made.body.id), 0)).status,
      ).toBe(404);
      expect(
        (
          await bearing(stranger).get(
            fixture.importing('team/delivery/build/Planned'),
          )
        ).status,
      ).toBe(404);
    } finally {
      await elsewhere.close();
    }
  });

  it('says what it changes from the live config it was proposed against, fingerprinted as runs are', async () => {
    const made = await owner().post(fixture.collection, {
      name: 'Faster',
      station: { ...fixture.live, prompt: 'Build it fast.', effort: 'low' },
    });

    expect(made.status).toBe(201);
    expect(made.body.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(made.body.changedFrom.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(made.body.changedFrom.fingerprint).not.toBe(made.body.fingerprint);
    expect(made.body.changedFrom.changes).toEqual([
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
      { part: 'effort', name: null, kind: 'added', was: null, now: 'low' },
    ]);

    const same = await owner().post(fixture.collection, {
      name: 'As it is',
      station: fixture.live,
    });

    expect(same.body.changedFrom).toEqual({
      fingerprint: same.body.fingerprint,
      changes: [],
    });
  });

  it('rejects what the line resource would, field by field under station, and a candidate with no name', async () => {
    const rejectedPaths = async (body: object) => {
      const answer = await owner().post(fixture.collection, body);

      expect(answer.status).toBe(422);
      expect(answer.body.type).toBe('urn:spotlight:problem:invalid');

      return pathsOf(answer);
    };

    expect(
      await rejectedPaths({
        name: 'Blank judge',
        station: {
          ...fixture.live,
          judge: { rubric: '   ', sample: 0.2, minAgreement: 0.6 },
        },
      }),
    ).toContain('station.judge.rubric');
    expect(
      await rejectedPaths({
        name: 'Unreadable judge',
        station: {
          ...fixture.live,
          judge: {
            rubric: 'scores: 1-10\nIs it good?',
            sample: 0.2,
            minAgreement: 0.6,
          },
        },
      }),
    ).toContain('station.judge.rubric');
    expect(
      await rejectedPaths({
        name: 'Elsewhere',
        station: { ...fixture.live, key: 'ship' },
      }),
    ).toContain('station.key');
    expect(
      await rejectedPaths({
        name: 'Nowhere',
        station: { ...fixture.live, passesTo: ['nowhere'] },
      }),
    ).toContain('station.passesTo');
    expect(await rejectedPaths({ station: fixture.live })).toEqual(['name']);
    for (const name of ['Live config, 2026-10-02', ' Padded', 'a/b']) {
      expect(await rejectedPaths({ name, station: fixture.live })).toEqual([
        'name',
      ]);
    }
    expect(await rejectedPaths({ name: 'Blockless' })).toContain('station');

    expect(
      (
        await owner().post(
          `/api/resources/lines/${fixture.lineId}/stations/nowhere/replay-candidates`,
          proposal(fixture.live, 'Lost', 'Build it.'),
        )
      ).status,
    ).toBe(404);
  });

  it('lists and imports only proposed candidates, of one station on request, and rejects a station or address that is none', async () => {
    const made = await proposed('Listed', 'Build it, listed.');
    const live = randomUUID();

    await db.insert(schema.replayCandidate).values({
      id: live,
      workspaceId: fixture.workspaceId,
      teamId: fixture.workspaceId,
      lineId: fixture.lineId,
      stationId: made.stationId,
      teamKey: 'team',
      lineKey: 'delivery',
      stationKey: 'build',
      name: 'Live config, 2026-10-02',
      kind: 'live',
      station: fixture.live,
      fingerprint: made.fingerprint,
      behaviourHash: made.fingerprint,
      scoringHash: made.fingerprint,
      checksChanges: false,
      changedFrom: made.fingerprint,
      changes: [],
      createdAt: new Date(),
    });

    const listed = await owner().get(
      `${fixture.listing(fixture.workspaceId)}?station=team/delivery/build`,
    );

    expect(listed.status).toBe(200);
    expect(
      listed.body.items.map((each: { id: string; kind: string }) => [
        each.id,
        each.kind,
      ]),
    ).toEqual([[made.id, 'proposed']]);
    expect(
      (
        await owner().get(
          fixture.importing('team/delivery/build/Live config, 2026-10-02'),
        )
      ).status,
    ).toBe(404);
    expect((await owner().get(fixture.item(live))).body.kind).toBe('live');

    for (const malformed of [
      'team/delivery/build',
      'team/delivery/build/a/b',
    ]) {
      const rejected = await owner().get(fixture.importing(malformed));

      expect(rejected.status).toBe(422);
      expect(rejected.headers['content-type']).toContain(
        'application/problem+json',
      );
    }
    expect(
      (
        await owner().get(
          `${fixture.listing(fixture.workspaceId)}?station=team/delivery/ship`,
        )
      ).body.items,
    ).toEqual([]);
    expect(
      (
        await owner().get(
          `${fixture.listing(fixture.workspaceId)}?station=team`,
        )
      ).status,
    ).toBe(422);

    const refused = await owner().delete(fixture.item(live), 0);

    expect(refused.status).toBe(409);
    expect(refused.body.type).toBe('urn:spotlight:problem:in-use');
  });

  it('is not deleted while a replay of it is running, and is once it has ended', async () => {
    const made = await proposed('Running', 'Build it, running.');
    const replayId = randomUUID();

    await db.insert(schema.replay).values({
      id: replayId,
      workspaceId: fixture.workspaceId,
      teamId: fixture.workspaceId,
      lineId: fixture.lineId,
      stationId: made.stationId,
      setId: randomUUID(),
      candidateId: made.id,
      baseline: false,
      scoringHash: made.fingerprint,
      judges: false,
      checked: false,
      ceilingAmount: 1,
      ceilingCurrency: 'USD',
      repeats: 1,
      state: 'running',
      startedAt: new Date(),
    });

    const rejected = await owner().delete(fixture.item(made.id), made.version);

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({
      type: 'urn:spotlight:problem:in-use',
    });

    await db
      .update(schema.replay)
      .set({ state: 'finished', endedAt: new Date() })
      .where(eq(schema.replay.id, replayId));

    expect(
      (await owner().delete(fixture.item(made.id), made.version)).status,
    ).toBe(204);
  });

  it('records each proposal and deletion in the configuration audit, naming the token and its client', async () => {
    const planner = await fixture.tokenWith(['plan']);
    const made = await bearing(planner).post(
      fixture.collection,
      proposal(fixture.live, 'Audited', 'Build it, audited.'),
    );

    expect(made.status).toBe(201);
    expect(
      (await bearing(planner).delete(fixture.item(made.body.id), 0)).status,
    ).toBe(204);

    const recorded = await db
      .select()
      .from(schema.configurationChange)
      .where(eq(schema.configurationChange.resourceId, made.body.id))
      .orderBy(schema.configurationChange.seq);

    expect(
      recorded.map((each) => [
        each.resource,
        each.action,
        each.key,
        each.actor,
        each.client,
      ]),
    ).toEqual([
      [
        'replay-candidate',
        'created',
        'team/delivery/build/Audited',
        'token',
        'cli/0.4.2',
      ],
      [
        'replay-candidate',
        'deleted',
        'team/delivery/build/Audited',
        'token',
        'cli/0.4.2',
      ],
    ]);
  });
});
