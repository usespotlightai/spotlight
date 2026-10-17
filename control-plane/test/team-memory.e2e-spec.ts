import { randomUUID } from 'node:crypto';
import { DrizzleMemoryRepository } from '@memory/infrastructure/persistence/drizzle/repositories/memory.repository';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

interface MemoryBody {
  readonly id: string;
  readonly kind: string;
  readonly body: string;
  readonly source: string;
  readonly status: string;
  readonly reach: string;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repository: string | null;
  readonly paths: readonly string[];
  readonly approvedBy: { readonly id: string; readonly name: string | null };
  readonly supersedes: string | null;
  readonly retirement: {
    readonly reason: string | null;
    readonly supersededBy: string | null;
    readonly by: { readonly id: string } | null;
  } | null;
  readonly superseded?: { readonly id: string } | null;
  readonly successor?: { readonly id: string } | null;
}

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
const LINE = randomUUID();
const STATION = randomUUID();

const memories = () => `/api/teams/${team.teamId.value}/memories`;

const listing = async (query = '', as = team.owner.value) =>
  (await served(app).get(`${memories()}${query}`).set(TEST_USER_HEADER, as))
    .body as MemoryBody[];

const writing = (body: Record<string, unknown>) =>
  served(app)
    .post(memories())
    .set(TEST_USER_HEADER, team.owner.value)
    .send(body);

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `memory-${randomUUID().slice(0, 8)}`,
  );
  await db.insert(schema.line).values({
    id: LINE,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: LINE,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: STATION,
      lineId: LINE,
      key: 'implementation',
      name: 'Implementation',
      position: 1,
      kind: 'work',
    },
    {
      id: randomUUID(),
      lineId: LINE,
      key: 'completed',
      name: 'Completed',
      position: 2,
      kind: 'completed',
    },
  ]);
  await db
    .insert(schema.lineRepository)
    .values({ lineId: LINE, repository: 'acme/api' });
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('the team’s memory', () => {
  it('makes a memory written on the page active at once, as the writer’s own', async () => {
    const written = await writing({
      kind: 'environment',
      body: 'Staging needs a restart after deploys.',
    });

    expect(written.status).toBe(201);
    expect(written.body).toMatchObject({
      kind: 'environment',
      source: 'person',
      status: 'active',
      reach: 'team',
      approvedBy: { id: team.owner.value, name: 'Ada' },
      retirement: null,
    });
    expect((await listing()).map((each) => each.body)).toContain(
      'Staging needs a restart after deploys.',
    );
  });

  it('ties a memory to a station and the paths of its line’s repository', async () => {
    const written = await writing({
      kind: 'rationale',
      body: 'Uploads retry in the request, not from a queue.',
      lineId: LINE,
      stationId: STATION,
      repository: 'acme/api',
      paths: ['src/uploads/retry.ts'],
    });

    expect(written.status).toBe(201);
    expect(written.body).toMatchObject({
      reach: 'station',
      lineId: LINE,
      stationId: STATION,
      repository: 'acme/api',
      paths: ['src/uploads/retry.ts'],
    });
  });

  it('refuses a line, station or repository the team does not have', async () => {
    for (const where of [
      { lineId: randomUUID() },
      { lineId: LINE, stationId: team.stationId.value },
      { repository: 'acme/elsewhere' },
      { kind: 'gossip' },
    ]) {
      const refused = await writing({
        kind: 'preference',
        body: 'Anything.',
        ...where,
      });

      expect(refused.status).toBe(422);
    }
  });

  it('narrows the list by kind, line, station, repository and path', async () => {
    const all = await listing();
    const byKind = await listing('?kind=rationale');
    const byLine = await listing(`?lineId=${LINE}`);
    const byStation = await listing(`?stationId=${STATION}`);
    const byRepository = await listing('?repository=acme/api');
    const byPath = await listing('?path=src/uploads');
    const byOtherPath = await listing('?path=docs');

    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(byKind.every((each) => each.kind === 'rationale')).toBe(true);
    expect(byKind.length).toBeGreaterThan(0);
    for (const narrowed of [byLine, byStation, byRepository, byPath]) {
      expect(narrowed.map((each) => each.body)).toEqual([
        'Uploads retry in the request, not from a queue.',
      ]);
    }
    expect(byOtherPath).toEqual([]);
    for (const nothing of ['.', './', '/']) {
      expect(
        (
          await served(app)
            .get(`${memories()}?path=${encodeURIComponent(nothing)}`)
            .set(TEST_USER_HEADER, team.owner.value)
        ).status,
      ).toBe(200);
    }
  });

  it('corrects a memory with a new one, retiring the old and linking the two', async () => {
    const old = (
      await writing({ kind: 'preference', body: 'Name branches after people.' })
    ).body as MemoryBody;

    const edited = await served(app)
      .post(`${memories()}/${old.id}/edit`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ kind: 'preference', body: 'Name branches after the ticket.' });

    expect(edited.status).toBe(201);
    const replacement = edited.body as MemoryBody;
    expect(replacement.supersedes).toBe(old.id);
    expect(replacement.superseded?.id).toBe(old.id);

    const retired = await eventually(async () => {
      const read = (
        await served(app)
          .get(`${memories()}/${old.id}`)
          .set(TEST_USER_HEADER, team.owner.value)
      ).body as MemoryBody;
      return read.status === 'retired' && read;
    });
    expect(retired.retirement?.supersededBy).toBe(replacement.id);
    expect(retired.successor?.id).toBe(replacement.id);
    expect((await listing('?status=retired')).map((each) => each.id)).toContain(
      old.id,
    );
    expect((await listing()).map((each) => each.id)).not.toContain(old.id);
  });

  it('retires a memory only with a reason, and only once', async () => {
    const memory = (
      await writing({ kind: 'failure', body: 'The upload test flakes.' })
    ).body as MemoryBody;
    const retire = (reason: string) =>
      served(app)
        .post(`${memories()}/${memory.id}/retire`)
        .set(TEST_USER_HEADER, team.owner.value)
        .send({ reason });

    const unexplained = await retire('   ');
    const explained = await retire('It was fixed in the runner image.');
    const again = await retire('Once more.');

    expect(unexplained.status).toBe(422);
    expect(explained.status).toBe(200);
    expect((explained.body as MemoryBody).retirement).toMatchObject({
      reason: 'It was fixed in the runner image.',
      by: { id: team.owner.value },
      supersededBy: null,
    });
    expect(again.status).toBe(409);
    expect((await listing()).map((each) => each.id)).not.toContain(memory.id);
  });

  it('keeps one correction when two arrive at once, and refuses correcting a retired memory', async () => {
    const old = (
      await writing({ kind: 'preference', body: 'Squash every merge.' })
    ).body as MemoryBody;
    const correcting = (body: string) =>
      served(app)
        .post(`${memories()}/${old.id}/edit`)
        .set(TEST_USER_HEADER, team.owner.value)
        .send({ kind: 'preference', body });

    const answers = await Promise.all([
      correcting('Squash merges into main.'),
      correcting('Rebase merges into main.'),
    ]);
    const later = await correcting('Merge however you like.');

    expect(answers.map((each) => each.status).sort()).toEqual([201, 409]);
    expect(later.status).toBe(409);
    const active = (await listing()).filter(
      (each) => each.supersedes === old.id,
    );
    expect(active).toHaveLength(1);
  });

  it('stops a retired memory reaching later runs', async () => {
    const memory = (
      await writing({ kind: 'environment', body: 'CI has no network.' })
    ).body as MemoryBody;
    const site = {
      teamId: TeamId.of(team.teamId.value),
      lineId: LINE,
      stationId: STATION,
      repositories: [],
    };
    const repository = app.get(DrizzleMemoryRepository);
    const applying = async () =>
      (await repository.mayReach(site))
        .filter((each) => each.appliesAt(site))
        .map((each) => each.id.value);

    expect(await applying()).toContain(memory.id);

    await served(app)
      .post(`${memories()}/${memory.id}/retire`)
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ reason: 'CI has network now.' });

    expect(await applying()).not.toContain(memory.id);
  });

  it('knows no memory of another team', async () => {
    const other = await openTeam(
      db,
      app.get(DrizzleTaskRepository),
      `other-${randomUUID().slice(0, 8)}`,
    );
    const theirs = (
      await served(app)
        .post(`/api/teams/${other.teamId.value}/memories`)
        .set(TEST_USER_HEADER, other.owner.value)
        .send({ kind: 'preference', body: 'Ours alone.' })
    ).body as MemoryBody;

    const read = await served(app)
      .get(`${memories()}/${theirs.id}`)
      .set(TEST_USER_HEADER, team.owner.value);

    expect(read.status).toBe(404);
  });

  it('shows nothing to anyone outside the team’s workspace', async () => {
    const stranger = randomUUID();
    await db.insert(schema.user).values({
      id: stranger,
      name: 'Cy',
      email: `${stranger}@example.com`,
    });

    const read = await served(app)
      .get(memories())
      .set(TEST_USER_HEADER, stranger);
    const written = await served(app)
      .post(memories())
      .set(TEST_USER_HEADER, stranger)
      .send({ kind: 'preference', body: 'Sneaky.' });

    expect(read.status).toBe(404);
    expect(written.status).toBe(404);
  });
});
