import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-check-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'c'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const TOKEN_HEADER = 'spotlight-workspace-token';
const LIVE_CHECK = {
  mostRegressions: 0,
  ceiling: 4,
  currency: 'USD',
  minGain: 0.05,
};

const attachmentStore = {
  received: async () => [],
  open: async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' }),
} as unknown as AttachmentStorePort;

const archiveStore: WorkspaceArchiveStorePort = {
  grantUpload: async (archive) => ({
    url: `https://archives.test/${archive.id.value}`,
    headers: {},
  }),
  stored: async (archive) => ({ size: archive.size, digest: archive.digest }),
  grantDownload: async (archive) =>
    `https://archives.test/${archive.id.value}?download`,
  remove: async () => {},
};

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
let readToken: string;
let planToken: string;
let stranger: string;
let guardingSet: string;
let originals: string[];

const http = () => served(app);

const owner = () => ({
  get: (path: string) =>
    http().get(path).set(TEST_USER_HEADER, team.owner.value),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set(TEST_USER_HEADER, team.owner.value)
      .send(body ?? {}),
  patch: (path: string) =>
    http().patch(path).set(TEST_USER_HEADER, team.owner.value),
  delete: (path: string) =>
    http().delete(path).set(TEST_USER_HEADER, team.owner.value),
});

const bearing = (token: string) => ({
  get: (path: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object, key: string | null = randomUUID()) => {
    const asked = http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Spotlight-Client', 'cli/1.2.3');

    return (key ? asked.set('Idempotency-Key', key) : asked).send(body);
  },
  delete: (path: string) =>
    http().delete(path).set('Authorization', `Bearer ${token}`),
});

const teamPath = () => `/api/teams/${team.teamId.value}`;
const stationPath = () => `${teamPath()}/lines/${DELIVERY}/stations/${BUILD}`;

const planned = (more: Record<string, unknown> = {}) => ({
  key: 'build',
  name: 'Build',
  kind: 'work',
  harness: 'claude-code',
  prompt: 'Build it, with care.',
  check: 'true',
  diffs: false,
  judge: { rubric: 'scores: yes-no\nDid it build?', sample: 1, trust: 0.5 },
  passesTo: ['ship'],
  ...more,
});

const checkBody = (station: unknown, pullRequest = 42) => ({
  lineId: DELIVERY,
  stationKey: 'build',
  station,
  reference: { commit: COMMIT, pullRequest },
});

interface CheckRead {
  id: string;
  verdict: string;
  undecidedBecause: string | null;
  replayId: string;
  baselineReplayId: string | null;
  attempt: number;
  candidateId: string;
  keptLive: string[];
  threshold: {
    mostRegressions: number;
    ceiling: { amount: number; currency: string };
  };
  tasks: number;
  compared: number;
  regressions: {
    taskId: string;
    candidate: string;
    baseline: string | null;
    reasons: { code: string; detail: string | null }[];
  }[];
  replayUrl: string | null;
  setName: string | null;
}

const anOriginal = async (): Promise<string> => {
  const taskId = randomUUID();
  const runId = randomUUID();
  const archiveId = randomUUID();
  const at = new Date();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: `Drain queue ${runId.slice(0, 4)}`,
    description: 'It stalls on restart.',
    raisedAtStationId: BUILD,
    raisedById: team.owner.value,
    assigneeId: team.owner.value,
    finishedAt: at,
  });
  await db.insert(schema.workspaceArchive).values({
    id: archiveId,
    workspaceId: team.workspaceId.value,
    continuityKey: `task-${taskId}`,
    taskId,
    grantedToRunId: randomUUID(),
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: at,
    sealedAt: at,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    taskId,
    taskRevision: 0,
    stationId: BUILD,
    harness: 'claude-code',
    state: 'completed',
    exitCode: 0,
    endedAt: at,
    spec: {
      checkouts: [
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: `spotlight/${taskId}`,
        },
      ],
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship', 'review'], noteLimit: 0 },
      continuity: { key: `task-${taskId}` },
      startingPoint: true,
    },
    briefedTask: BriefedTask.of({
      stationId: StationId.of(BUILD),
      title: 'Drain the queue',
      description: 'It stalls on restart.',
      reviewing: null,
      attachments: [],
      notes: [],
      openRemarks: [],
    }).parts,
    briefedMemories: { briefed: [], cut: [] },
    startedFromArchiveId: archiveId,
    startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
    startedFromAttempt: 1,
    startedFromAt: at,
  });

  return runId;
};

const openSet = async (name: string, runs: readonly string[]) => {
  const opened = await owner()
    .post(`${stationPath()}/replay-sets`, { name })
    .expect(201);
  const setId = opened.body.id as string;

  for (const runId of runs) {
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, { runId })
      .expect(204);
  }

  return setId;
};

const readCheck = async (id: string, token = readToken): Promise<CheckRead> =>
  (await bearing(token).get(`${teamPath()}/replay-checks/${id}`).expect(200))
    .body as CheckRead;

const startCheck = async (station: unknown): Promise<CheckRead> =>
  (
    await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody(station))
      .expect(201)
  ).body as CheckRead;

const baselineOf = (check: CheckRead) =>
  eventually(async () => (await readCheck(check.id)).baselineReplayId);

const settled = async (
  replayId: string,
  succeeded: (position: number) => boolean | null,
  state: 'finished' | 'stopped' = 'finished',
) => {
  await db.transaction(async (tx) => {
    const entries = await tx
      .select()
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, replayId));

    for (const entry of entries) {
      const scored = succeeded(entry.position);

      await tx
        .update(schema.replayEntry)
        .set({
          runId: entry.runId ?? randomUUID(),
          queued: false,
          outcome: 'completed',
          stopped: false,
          asked: false,
          next: 'ship',
          endedAt: new Date(),
          measured: true,
          steps: 10,
          ms: 60_000,
          changedLines: 4,
          costAmount: 0.25,
          costCurrency: 'USD',
          checks: {
            state: scored === false ? 'failed' : 'passed',
            failedAt: scored === false ? ['api'] : [],
            why: null,
          },
          succeeded: scored,
          reasons:
            scored === false
              ? [{ code: 'check-failed', detail: 'api', steps: [], hunks: [] }]
              : [],
        })
        .where(
          sql`${schema.replayEntry.replayId} = ${replayId} and ${schema.replayEntry.position} = ${entry.position}`,
        );
    }

    await tx
      .update(schema.replay)
      .set({
        state,
        endedAt: new Date(),
        version: sql`${schema.replay.version} + 1`,
      })
      .where(eq(schema.replay.id, replayId));
  });
};

const tokenWith = async (scopes: readonly string[]) => {
  const issued = await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `checks-${scopes.join('-')}`, scopes });

  expect(issued.status).toBe(201);

  return issued.headers[TOKEN_HEADER] as string;
};

beforeAll(async () => {
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `checks-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
    replayCheck: LIVE_CHECK,
  });
  await db.insert(schema.lineRepository).values({
    lineId: DELIVERY,
    repository: Repository.of('acme/api').value,
    setup: 'npm ci',
  });
  await db.insert(schema.station).values([
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: BUILD,
      lineId: DELIVERY,
      key: 'build',
      name: 'Build',
      position: 1,
      kind: 'work',
      harness: 'claude-code',
      agentPrompt: 'Build it.',
      check: 'npm test',
      diffs: true,
    },
    {
      id: SHIP,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
      position: 2,
      kind: 'work',
      harness: 'claude-code',
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 3,
      kind: 'completed',
    },
  ]);
  await db.insert(schema.stationRoute).values({
    stationId: BUILD,
    toStationId: SHIP,
  });

  stranger = randomUUID();
  await db.insert(schema.user).values({
    id: stranger,
    name: 'Eve',
    email: `${stranger}@example.com`,
  });

  await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      name: 'build-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          usual: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);

  readToken = await tokenWith(['read']);
  planToken = await tokenWith(['plan']);
  originals = [await anOriginal(), await anOriginal(), await anOriginal()];
  guardingSet = await openSet('Queue fixes', originals);
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a replay set guarding a station’s changes', () => {
  it('is flagged by one who may plan, one set per station, and shows as such', async () => {
    const other = await openSet('Flaky', [originals[0] as string]);

    await bearing(readToken)
      .post(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`, {}, null)
      .expect(403);
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`, {}, null)
      .expect(204);
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`, {}, null)
      .expect(204);

    const refused = await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${other}/guards-changes`, {}, null)
      .expect(409);
    expect(refused.body.detail).toContain('guards the changes');

    const sets = (
      await bearing(readToken).get(`${stationPath()}/replay-sets`).expect(200)
    ).body as { id: string; guardsChanges: boolean }[];
    expect(sets.map((each) => [each.id, each.guardsChanges])).toEqual(
      expect.arrayContaining([
        [guardingSet, true],
        [other, false],
      ]),
    );

    await bearing(planToken)
      .delete(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`)
      .expect(204);
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${other}/guards-changes`, {}, null)
      .expect(204);
    await bearing(planToken)
      .delete(`${teamPath()}/replay-sets/${other}/guards-changes`)
      .expect(204);
    const audited = await eventually(async () => {
      const rows = await db
        .select()
        .from(schema.configurationChange)
        .where(eq(schema.configurationChange.resourceId, guardingSet))
        .orderBy(schema.configurationChange.seq);

      return rows.length >= 2 && rows;
    });
    expect(
      audited.map((each) => [each.resource, each.action, each.details]),
    ).toEqual([
      ['replay-set', 'updated', { guardsChanges: true }],
      ['replay-set', 'updated', { guardsChanges: false }],
    ]);
    expect(audited.every((each) => each.tokenId !== null)).toBe(true);
  });
});

describe('a replay check', () => {
  it('is refused, saying why, when no set guards the station', async () => {
    const refused = await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody(planned()))
      .expect(409);

    expect(refused.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(refused.body.detail).toContain(
      'No replay set guards the changes of the station build',
    );
  });

  it('is refused when the line has no replay_check', async () => {
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`, {}, null)
      .expect(204);
    await db
      .update(schema.line)
      .set({ replayCheck: null })
      .where(eq(schema.line.id, DELIVERY));

    try {
      const refused = await bearing(planToken)
        .post(`${teamPath()}/replay-checks`, checkBody(planned()))
        .expect(409);

      expect(refused.body.detail).toContain('has no replay_check');
    } finally {
      await db
        .update(schema.line)
        .set({ replayCheck: LIVE_CHECK })
        .where(eq(schema.line.id, DELIVERY));
    }
  });

  it('names each problem of a planned station the line would not take, and refuses one that changes nothing that runs', async () => {
    const invalid = await bearing(planToken)
      .post(
        `${teamPath()}/replay-checks`,
        checkBody(planned({ effort: 'huge' })),
      )
      .expect(422);

    expect(invalid.body.errors).toEqual([
      expect.objectContaining({ path: 'station.effort', severity: 'error' }),
    ]);

    const unchanged = await bearing(planToken)
      .post(
        `${teamPath()}/replay-checks`,
        checkBody({
          key: 'build',
          name: 'Build',
          kind: 'work',
          harness: 'claude-code',
          prompt: 'Build it.',
          check: 'make test',
          passesTo: ['ship'],
        }),
      )
      .expect(409);

    expect(unchanged.body.type).toBe('urn:spotlight:problem:nothing-to-replay');
    expect(unchanged.body.detail).toContain('check');
  });

  it('is started only by those who may plan, with an Idempotency-Key, and read by any reader of the team', async () => {
    await bearing(readToken)
      .post(`${teamPath()}/replay-checks`, checkBody(planned()))
      .expect(403);
    await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody(planned()), null)
      .expect(400);
    await http()
      .post(`${teamPath()}/replay-checks`)
      .set(TEST_USER_HEADER, stranger)
      .set('Idempotency-Key', randomUUID())
      .send(checkBody(planned()))
      .expect(404);
  });

  it('replays the planned change scored with the live check and judge, under the live line’s threshold, against a baseline', async () => {
    const check = await startCheck(planned());

    expect(check).toMatchObject({
      verdict: 'running',
      keptLive: ['check', 'judge', 'diffs'],
      threshold: {
        mostRegressions: 0,
        ceiling: { amount: 4, currency: 'USD' },
      },
      tasks: 3,
      setName: 'Queue fixes',
    });
    expect(check.replayUrl).toContain(
      `http://localhost:3000/w/${team.slug}/team/${team.teamId.value}/lines/${DELIVERY}/stations/${BUILD}/replays/${check.replayId}`,
    );

    const [candidate] = await db
      .select()
      .from(schema.replayCandidate)
      .where(eq(schema.replayCandidate.id, check.candidateId));
    expect(candidate?.kind).toBe('planned');
    expect(candidate?.name).toBe('Planned change, PR #42');
    expect(candidate?.referenceCommit).toBe(COMMIT);
    expect(candidate?.station).toMatchObject({
      check: 'npm test',
      diffs: true,
    });
    expect(candidate?.station).not.toHaveProperty('judge');

    const [replay] = await db
      .select()
      .from(schema.replay)
      .where(eq(schema.replay.id, check.replayId));
    expect(replay).toMatchObject({
      checked: true,
      judges: false,
      ceilingAmount: 4,
      ceilingCurrency: 'USD',
    });
    const [baseline] = await db
      .select()
      .from(schema.replay)
      .where(eq(schema.replay.id, await baselineOf(check)));
    expect(baseline?.baseline).toBe(true);

    await db
      .update(schema.line)
      .set({
        replayCheck: {
          mostRegressions: 9,
          ceiling: 900,
          currency: 'USD',
          minGain: 0.05,
        },
      })
      .where(eq(schema.line.id, DELIVERY));
    try {
      expect((await readCheck(check.id)).threshold).toMatchObject({
        mostRegressions: 0,
        ceiling: { amount: 4, currency: 'USD' },
      });
    } finally {
      await db
        .update(schema.line)
        .set({ replayCheck: LIVE_CHECK })
        .where(eq(schema.line.id, DELIVERY));
    }

    const again = await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody(planned(), 43))
      .expect(200);
    expect(again.body).toMatchObject({ id: check.id, reused: true });
    expect(again.headers['idempotent-replayed']).toBeUndefined();
    const fresh = check as CheckRead & {
      reused: boolean;
      threshold: { unpricedRun: { amount: number; currency: string } };
    };
    expect(fresh.reused).toBe(false);
    expect(fresh.threshold.unpricedRun.currency).toBe('USD');
    expect(fresh.threshold.unpricedRun.amount).toBeCloseTo(4 / 3, 5);

    const key = randomUUID();
    const once = await bearing(planToken)
      .post(
        `${teamPath()}/replay-checks`,
        checkBody(planned({ prompt: 'Build it, once.' })),
        key,
      )
      .expect(201);
    const retried = await bearing(planToken)
      .post(
        `${teamPath()}/replay-checks`,
        checkBody(planned({ prompt: 'Build it, once.' })),
        key,
      )
      .expect(201);
    expect(retried.body.id).toBe(once.body.id);
    expect(retried.body.reused).toBe(false);
    expect(retried.headers['idempotent-replayed']).toBe('true');
  });

  it('passes when no task regressed past the threshold, and fails, naming why, when one did', async () => {
    const passing = await startCheck(
      planned({ prompt: 'Build it, and pass.' }),
    );
    await settled(await baselineOf(passing), () => true);
    await settled(passing.replayId, () => true);

    expect(await readCheck(passing.id)).toMatchObject({
      verdict: 'passed',
      undecidedBecause: null,
      compared: 3,
      regressions: [],
    });

    const failing = await startCheck(
      planned({ prompt: 'Build it, and fail.' }),
    );
    await settled(failing.replayId, (position) => position !== 1);

    const failed = await readCheck(failing.id);
    expect(failed.verdict).toBe('failed');
    expect(failed.regressions).toEqual([
      expect.objectContaining({
        candidate: ['failed'],
        baseline: ['succeeded'],
        reasons: [{ code: 'check-failed', detail: 'api' }],
      }),
    ]);
  });

  it('is undecided when its replay stopped, or too few tasks were scored', async () => {
    const stopping = await startCheck(
      planned({ prompt: 'Build it, then stop.' }),
    );
    await settled(stopping.replayId, () => true, 'stopped');

    expect(await readCheck(stopping.id)).toMatchObject({
      verdict: 'undecided',
      undecidedBecause: 'stopped',
    });

    const unscored = await startCheck(
      planned({ prompt: 'Build it, unscored.' }),
    );
    await settled(unscored.replayId, (position) =>
      position === 0 ? true : null,
    );

    expect(await readCheck(unscored.id)).toMatchObject({
      verdict: 'undecided',
      undecidedBecause: 'too-few-scored',
      compared: 1,
    });
  });

  it('starts another attempt once the earlier one is undecided, the threshold changed or the set changed, and answers the one that stands', async () => {
    const change = planned({ prompt: 'Build it, attempted.' });
    const first = await startCheck(change);
    expect(first.attempt).toBe(1);

    await settled(first.replayId, () => true, 'stopped');
    const second = await startCheck(change);
    expect(second.attempt).toBe(2);

    await db
      .update(schema.line)
      .set({ replayCheck: { ...LIVE_CHECK, mostRegressions: 1 } })
      .where(eq(schema.line.id, DELIVERY));
    try {
      expect((await startCheck(change)).attempt).toBe(3);
    } finally {
      await db
        .update(schema.line)
        .set({ replayCheck: LIVE_CHECK })
        .where(eq(schema.line.id, DELIVERY));
    }

    const standing = await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody(change))
      .expect(200);
    expect(standing.body.id).toBe(second.id);

    await owner()
      .patch(`${teamPath()}/replay-sets/${guardingSet}`)
      .send({ name: 'Queue fixes' })
      .expect(204);
    expect(
      (
        await bearing(planToken)
          .post(`${teamPath()}/replay-checks`, checkBody(change))
          .expect(200)
      ).body.id,
    ).toBe(second.id);

    await owner()
      .post(`${teamPath()}/replay-sets/${guardingSet}/entries`, {
        runId: await anOriginal(),
      })
      .expect(204);
    expect((await startCheck(change)).attempt).toBe(4);
  });

  it('checks a change to the line’s repositories or to where a task may go next, and never moves where the station runs', async () => {
    const live = {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it.',
      check: 'npm test',
      passesTo: ['ship'],
    };
    const imaged = (
      await bearing(planToken)
        .post(`${teamPath()}/replay-checks`, {
          ...checkBody({ ...live, runners: ['gpu'] }),
          line: {
            repositories: [
              {
                name: 'acme/api',
                setup: 'npm ci',
                image: 'ghcr.io/acme/api:next',
              },
            ],
          },
        })
        .expect(201)
    ).body as CheckRead;

    expect(imaged.keptLive).toEqual(['runners']);
    const [candidate] = await db
      .select()
      .from(schema.replayCandidate)
      .where(eq(schema.replayCandidate.id, imaged.candidateId));
    expect(candidate?.lineFields).toEqual({
      repositories: [
        { name: 'acme/api', setup: 'npm ci', image: 'ghcr.io/acme/api:next' },
      ],
    });
    expect(candidate?.station).not.toHaveProperty('runners');

    const refused = await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, {
        ...checkBody(live),
        line: { repositories: [{ name: '' }] },
      })
      .expect(422);
    expect(refused.body.errors[0].path).toMatch(/^line\.repositories/);

    await bearing(planToken)
      .post(`${teamPath()}/replay-checks`, checkBody({ ...live, passesTo: [] }))
      .expect(201);
  });

  it('compares checks started together against the one baseline that comes, and wants a new one once the live station is scored differently', async () => {
    const race = await openSet('Race', [
      originals[0] as string,
      originals[2] as string,
    ]);
    await bearing(planToken)
      .delete(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`)
      .expect(204);
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${race}/guards-changes`, {}, null)
      .expect(204);

    try {
      const [one, two] = await Promise.all([
        startCheck(planned({ prompt: 'Build it, racing.' })),
        startCheck(planned({ prompt: 'Build it, racing too.' })),
      ]);
      const shared = await baselineOf(one as CheckRead);

      expect(await baselineOf(two as CheckRead)).toBe(shared);
      expect(
        (
          await db
            .select()
            .from(schema.replay)
            .where(eq(schema.replay.setId, race))
        ).filter((each) => each.baseline),
      ).toHaveLength(1);

      await db
        .update(schema.station)
        .set({ check: 'npm run test:all' })
        .where(eq(schema.station.id, BUILD));
      try {
        const rescored = await startCheck(
          planned({ prompt: 'Build it, rescored.' }),
        );
        const fresh = await baselineOf(rescored);

        expect(fresh).not.toBe(shared);
        expect((await readCheck((one as CheckRead).id)).baselineReplayId).toBe(
          shared,
        );
      } finally {
        await db
          .update(schema.station)
          .set({ check: 'npm test' })
          .where(eq(schema.station.id, BUILD));
      }
    } finally {
      await bearing(planToken)
        .delete(`${teamPath()}/replay-sets/${race}/guards-changes`)
        .expect(204);
      await bearing(planToken)
        .post(
          `${teamPath()}/replay-sets/${guardingSet}/guards-changes`,
          {},
          null,
        )
        .expect(204);
    }
  });

  it('is undecided, saying so, once the baseline it found is gone and none can come', async () => {
    const check = await startCheck(planned({ prompt: 'Build it, baseless.' }));
    const baseline = await baselineOf(check);

    await eventually(async () => {
      const [row] = await db
        .select()
        .from(schema.replayCheck)
        .where(eq(schema.replayCheck.id, check.id));

      return row?.baseline === 'found';
    });
    await settled(baseline, () => true);
    await db.delete(schema.replay).where(eq(schema.replay.id, baseline));
    await settled(check.replayId, () => true);

    expect(await readCheck(check.id)).toMatchObject({
      verdict: 'undecided',
      undecidedBecause: 'no-baseline',
      baselineReplayId: null,
    });
  });

  it('are listed per set, newest first, a page at a time, to any reader of the team, and the line shows its threshold', async () => {
    const all = (
      await bearing(readToken)
        .get(`${teamPath()}/replay-sets/${guardingSet}/replay-checks?limit=200`)
        .expect(200)
    ).body as {
      id: string;
      createdAt: string;
      verdict: string;
      replayUrl: string;
    }[];

    expect(all.length).toBeGreaterThan(2);
    expect(
      [...all].sort((one, other) =>
        other.createdAt.localeCompare(one.createdAt),
      ),
    ).toEqual(all);
    expect(all[0]?.replayUrl).toContain(`/w/${team.slug}/team/`);

    const first = (
      await bearing(readToken)
        .get(`${teamPath()}/replay-sets/${guardingSet}/replay-checks?limit=1`)
        .expect(200)
    ).body as { id: string }[];
    const next = (
      await bearing(readToken)
        .get(
          `${teamPath()}/replay-sets/${guardingSet}/replay-checks?limit=1&before=${first[0]?.id}`,
        )
        .expect(200)
    ).body as { id: string }[];
    expect([first[0]?.id, next[0]?.id]).toEqual([all[0]?.id, all[1]?.id]);

    await http()
      .get(`${teamPath()}/replay-sets/${guardingSet}/replay-checks`)
      .set(TEST_USER_HEADER, stranger)
      .expect(404);

    const lines = (await owner().get(`${teamPath()}/lines`).expect(200))
      .body as { id: string; replayCheck: unknown }[];
    expect(lines.find((each) => each.id === DELIVERY)?.replayCheck).toEqual(
      LIVE_CHECK,
    );
  });

  it('goes with the set it guards when the set is deleted', async () => {
    const doomed = await openSet('Doomed', [originals[1] as string]);
    await bearing(planToken)
      .delete(`${teamPath()}/replay-sets/${guardingSet}/guards-changes`)
      .expect(204);
    await bearing(planToken)
      .post(`${teamPath()}/replay-sets/${doomed}/guards-changes`, {}, null)
      .expect(204);

    const check = await startCheck(planned({ prompt: 'Build it, then go.' }));
    const baseline = await baselineOf(check);
    await settled(check.replayId, () => true);
    await settled(baseline, () => true);

    await owner().delete(`${teamPath()}/replay-sets/${doomed}`).expect(204);

    await eventually(async () => {
      const read = await bearing(readToken).get(
        `${teamPath()}/replay-checks/${check.id}`,
      );

      return read.status === 404;
    });
  });
});
