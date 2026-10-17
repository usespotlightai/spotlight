import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import {
  ARCHIVE_REFERENCES,
  type ArchiveReferencesPort,
} from '@work/application/ports/archive-references.port';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import {
  REPLAY_CANDIDATES,
  type ReplayCandidatesPort,
} from '@work/application/ports/replay-candidates.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { forgetRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-experiment-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'q'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const POLISH = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const DAY = 24 * 60 * 60_000;
const TOKEN_HEADER = 'spotlight-workspace-token';

const attachmentStore = {
  received: async () => [],
  taken: async () => undefined,
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

const http = () => served(app);

const as = (who: string) => ({
  get: (path: string) => http().get(path).set(TEST_USER_HEADER, who),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set(TEST_USER_HEADER, who)
      .send(body ?? {}),
  put: (path: string) => http().put(path).set(TEST_USER_HEADER, who),
  patch: (path: string, body: object) =>
    http().patch(path).set(TEST_USER_HEADER, who).send(body),
  delete: (path: string) => http().delete(path).set(TEST_USER_HEADER, who),
});

const bearing = (token: string) => ({
  get: (path: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

const owner = () => as(team.owner.value);

const teamPath = () => `/api/teams/${team.teamId.value}`;
const stationPath = (stationId: string = BUILD) =>
  `${teamPath()}/lines/${DELIVERY}/stations/${stationId}`;

interface Original {
  readonly taskId: string;
  readonly runId: string;
  readonly archiveId: string;
}

const anOriginal = async (
  input: {
    stationId?: string;
    startedFrom?: boolean;
    heardFrom?: string;
    raisedAt?: string;
  } = {},
): Promise<Original> => {
  const stationId = input.stationId ?? BUILD;
  const taskAt = stationId === POLISH ? BUILD : stationId;
  const taskId = randomUUID();
  const runId = randomUUID();
  const archiveId = randomUUID();
  const at = new Date();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: input.heardFrom ?? 'person',
    workspaceId: team.workspaceId.value,
    stationId: taskAt,
    title: `Drain queue ${runId.slice(0, 4)}`,
    description: 'It stalls on restart.',
    raisedAtStationId: input.raisedAt ?? taskAt,
    raisedById: input.heardFrom ? null : team.owner.value,
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
    stationId,
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
      stationId: StationId.of(stationId),
      title: 'Drain the queue',
      description: 'It stalls on restart.',
      reviewing: null,
      attachments: [],
      notes: [],
      openRemarks: [],
    }).parts,
    briefedMemories: { briefed: [], cut: [] },
    ...(input.startedFrom === false
      ? {}
      : {
          startedFromArchiveId: archiveId,
          startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
          startedFromAttempt: 1,
          startedFromAt: at,
        }),
  });

  return { taskId, runId, archiveId };
};

const turnedOut = async (
  original: Original,
  how: {
    ending: 'completed' | 'failed';
    next: 'closed' | 'sent-back' | null;
  },
) => {
  await db.insert(schema.runRecord).values({
    runId: original.runId,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    lineId: DELIVERY,
    stationId: BUILD,
    taskId: original.taskId,
    harness: 'claude-code',
    repositories: [],
    skills: [],
    endedAt: new Date(),
    ending: how.ending,
    round: 1,
    nextAct: how.next,
    nextAt: how.next ? new Date() : null,
  });
};

const openSet = async (name: string, ...originals: Original[]) =>
  openSetAt(BUILD, name, ...originals);

const openSetAt = async (
  stationId: string,
  name: string,
  ...originals: Original[]
) => {
  const opened = await owner()
    .post(`${stationPath(stationId)}/replay-sets`, { name })
    .expect(201);
  const setId = opened.body.id as string;

  for (const each of originals) {
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: each.runId,
      })
      .expect(204);
  }

  return setId;
};

const replayRow = async (replayId: string) => {
  const [row] = await db
    .select()
    .from(schema.replay)
    .where(eq(schema.replay.id, replayId));

  return row;
};

const entriesOf = (replayId: string) =>
  db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.replayId, replayId))
    .orderBy(schema.replayEntry.position);

const replayRunsOf = async (replayIds: readonly string[]) =>
  (
    await db
      .select({ runId: schema.replayEntry.runId })
      .from(schema.replayEntry)
      .where(inArray(schema.replayEntry.replayId, [...replayIds]))
  ).flatMap((each) => (each.runId ? [each.runId] : []));

const runRow = async (runId: string) => {
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return row;
};

const dispatched = async () => {
  await app.get(DispatchReplayRuns).workDue();
};

const claimed = async (): Promise<{ token: string; runId: string }> => {
  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  return { token: handed.token, runId: handed.work.run.id };
};

const usage = (amount: number) =>
  Buffer.from(
    JSON.stringify({
      sessionId: 'session_1',
      update: {
        sessionUpdate: 'usage_update',
        used: 1_000,
        size: 200_000,
        cost: { amount, currency: 'USD' },
      },
    }),
  ).toString('base64');

const finishes = async (
  { token, runId }: { token: string; runId: string },
  cost: number,
  failed = false,
) => {
  await http()
    .post(`/api/runs/${runId}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      events: [
        {
          seq: 1,
          type: 'output',
          at: new Date().toISOString(),
          data: usage(cost),
        },
      ],
    })
    .expect(204);
  await http()
    .post(`/api/runs/${runId}/completion`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      exitCode: failed ? 1 : 0,
      failed,
      outcome: failed ? undefined : { next: 'ship', note: 'Done here.' },
      sessionId: 'session_1',
      kept: true,
    })
    .expect(200);
};

const settledRun = (runId: string) =>
  eventually(async () => {
    const [entry] = await db
      .select()
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.runId, runId));

    return entry?.outcome !== null && entry?.measured === true;
  });

const startReplay = async (
  setId: string,
  candidate: string,
  amount: number,
): Promise<{ id: string; baselineId: string | null }> => {
  const started = (
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/replays`, {
        candidate,
        ceiling: { amount, currency: 'USD' },
      })
      .expect(201)
  ).body as {
    id: string;
    ceiling: { amount: number; currency: string };
    baseline: {
      id: string;
      ceiling: { amount: number; currency: string };
      status: string;
    } | null;
  };

  expect(started.ceiling).toEqual({ amount, currency: 'USD' });
  if (started.baseline) {
    expect(started.baseline.ceiling).toEqual({ amount, currency: 'USD' });
    expect(started.baseline.status).toBe(
      started.baseline.id === started.id ? 'started' : 'starting',
    );
  }

  return { id: started.id, baselineId: started.baseline?.id ?? null };
};

const tokenWith = async (scopes: readonly string[]) => {
  const issued = await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `replays-${scopes.join('-')}`, scopes });

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
    `experiment-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
  });
  await db.insert(schema.lineRepository).values({
    lineId: DELIVERY,
    repository: Repository.of('acme/api').value,
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
      id: POLISH,
      lineId: DELIVERY,
      key: 'polish',
      name: 'Polish',
      position: 3,
      kind: 'work',
      harness: 'claude-code',
    },
    {
      id: randomUUID(),
      lineId: DELIVERY,
      key: 'completed',
      name: 'Completed',
      position: 4,
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
      session: 'session_1',
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
}, 60_000);

afterAll(async () => {
  await forgetRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a replay set', () => {
  it('is built from a station’s past runs, rejecting those that cannot be replayed and those of another station', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const unanchored = await anOriginal({ startedFrom: false });
    const elsewhere = await anOriginal({ stationId: SHIP });

    const picks = (
      await owner().get(`${stationPath()}/replayable-runs`).expect(200)
    ).body as {
      runId: string;
      unreplayableReason: string | null;
      title: string;
    }[];

    expect(
      picks.find((each) => each.runId === first.runId)?.unreplayableReason,
    ).toBeNull();
    expect(
      picks.find((each) => each.runId === unanchored.runId)?.unreplayableReason,
    ).toBe('no-starting-point');
    expect(picks.some((each) => each.runId === elsewhere.runId)).toBe(false);

    const setId = await openSet('Queue fixes', first, second);

    const rejected = await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: unanchored.runId,
      })
      .expect(409);
    expect(rejected.body.detail).toContain('never reported a starting point');
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: elsewhere.runId,
      })
      .expect(422);
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: first.runId,
      })
      .expect(409);

    await owner()
      .patch(`${teamPath()}/replay-sets/${setId}`, { name: 'Hard queues' })
      .expect(204);

    const sets = (await owner().get(`${stationPath()}/replay-sets`).expect(200))
      .body as {
      id: string;
      name: string;
      entries: {
        runId: string;
        unreplayableReason: string | null;
        title: string;
        state: string;
        endedAt: string | null;
      }[];
    }[];
    const set = sets.find((each) => each.id === setId);

    expect(set?.name).toBe('Hard queues');
    expect(
      set?.entries.map((each) => [
        each.runId,
        each.unreplayableReason,
        each.title,
        each.state,
      ]),
    ).toEqual([
      [
        first.runId,
        null,
        `Drain queue ${first.runId.slice(0, 4)}`,
        'completed',
      ],
      [
        second.runId,
        null,
        `Drain queue ${second.runId.slice(0, 4)}`,
        'completed',
      ],
    ]);
    expect(set?.entries.every((each) => each.endedAt !== null)).toBe(true);
  });

  it('shows a run whose task was deleted as one that can no longer be replayed', async () => {
    const kept = await anOriginal();
    const setId = await openSet('Deleted later', kept);

    await db.delete(schema.task).where(eq(schema.task.id, kept.taskId));

    const sets = (await owner().get(`${stationPath()}/replay-sets`).expect(200))
      .body as {
      id: string;
      entries: { unreplayableReason: string | null }[];
    }[];

    expect(
      sets.find((each) => each.id === setId)?.entries[0]?.unreplayableReason,
    ).toBe('task-gone');
  });

  it('keeps the archives its runs started from while it holds them, and lets them go after', async () => {
    const original = await anOriginal();
    const setId = await openSet('Pinned', original);
    const references = app.get<ArchiveReferencesPort>(ARCHIVE_REFERENCES);
    const archives = app.get(DrizzleWorkspaceArchiveRepository);
    const archiveId = WorkspaceArchiveId.of(original.archiveId);
    const at = new Date(Date.now() + 60 * DAY);
    const due = async () =>
      (await references.due(WorkspaceArchive.removalCutoffs(at), 5_000)).find(
        (each) => each.id.equals(archiveId),
      );

    await eventually(async () => {
      const [startingPointHold] = await db
        .select()
        .from(schema.startingPointHold)
        .where(eq(schema.startingPointHold.holder, `replay-set:${setId}`));

      return startingPointHold?.runIds.includes(original.runId) ?? false;
    });

    expect(await due()).toBeUndefined();

    await owner()
      .delete(`${teamPath()}/replay-sets/${setId}/entries/${original.runId}`)
      .expect(204);

    await eventually(async () => (await due()) !== undefined);

    const facts = (await due())?.facts;
    expect(facts?.pinned).toBe(false);
    expect(
      (await archives.find(archiveId))?.removableAt(at, facts ?? never()),
    ).toBe(true);
  });

  it('shows what it is made of, warns when one outcome crowds it, and suggests recent runs that even it out without adding them', async () => {
    const failures: Original[] = [];
    for (let at = 0; at < 4; at += 1) {
      const failed = await anOriginal();
      await turnedOut(failed, { ending: 'failed', next: null });
      failures.push(failed);
    }
    const heard = await anOriginal({ heardFrom: 'slack' });
    await turnedOut(heard, { ending: 'failed', next: null });
    const handedOn = await anOriginal({ raisedAt: SHIP });
    await turnedOut(handedOn, { ending: 'failed', next: null });
    const accepted = await anOriginal();
    await turnedOut(accepted, { ending: 'completed', next: 'closed' });
    const setId = await openSet(
      'Lopsided',
      ...failures,
      heard,
      handedOn,
      accepted,
    );

    const sentBack = await anOriginal();
    await turnedOut(sentBack, { ending: 'completed', next: 'sent-back' });
    const alsoAccepted = await anOriginal();
    await turnedOut(alsoAccepted, { ending: 'completed', next: 'closed' });
    const alsoFailed = await anOriginal();
    await turnedOut(alsoFailed, { ending: 'failed', next: null });

    const sets = (await owner().get(`${stationPath()}/replay-sets`).expect(200))
      .body as {
      id: string;
      composition: {
        outcomes: { outcome: string; count: number }[];
        origins: { origin: string; count: number }[];
        oldest: string | null;
        median: string | null;
        newest: string | null;
        balanceWarning: {
          dominant: string;
          count: number;
          entries: number;
        } | null;
      };
      entries: { runId: string; outcome: string; origin: string | null }[];
    }[];
    const set = sets.find((each) => each.id === setId);

    expect(set?.composition.outcomes).toEqual([
      { outcome: 'accepted', count: 1 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 6 },
      { outcome: 'other', count: 0 },
    ]);
    expect(set?.composition.origins).toEqual([
      { origin: 'person', count: 5 },
      { origin: 'slack', count: 1 },
      { origin: 'station', count: 1 },
    ]);
    expect(set?.composition.balanceWarning).toEqual({
      dominant: 'failed',
      count: 6,
      entries: 7,
    });
    expect(set?.composition.oldest).not.toBeNull();
    expect(set?.composition.newest).not.toBeNull();
    expect(
      set?.entries.find((each) => each.runId === heard.runId),
    ).toMatchObject({ outcome: 'failed', origin: 'slack' });
    expect(
      set?.entries.find((each) => each.runId === handedOn.runId)?.origin,
    ).toBe('station');

    const suggested = (
      await owner()
        .get(`${teamPath()}/replay-sets/${setId}/suggestions`)
        .expect(200)
    ).body as {
      runId: string;
      outcome: string;
      unreplayableReason: string | null;
    }[];

    expect(suggested.length).toBeLessThanOrEqual(5);
    expect(suggested.map((each) => each.runId)).toEqual(
      expect.arrayContaining([sentBack.runId, alsoAccepted.runId]),
    );
    expect(
      suggested.every(
        (each) =>
          (each.outcome === 'accepted' || each.outcome === 'sent-back') &&
          each.unreplayableReason === null,
      ),
    ).toBe(true);
    expect(suggested.some((each) => each.runId === alsoFailed.runId)).toBe(
      false,
    );
    expect(suggested.some((each) => each.runId === accepted.runId)).toBe(false);

    const after = (
      await owner().get(`${stationPath()}/replay-sets`).expect(200)
    ).body as { id: string; entries: unknown[] }[];
    expect(after.find((each) => each.id === setId)?.entries).toHaveLength(7);
  });

  it('is read by those who may read the team, changed by those who may plan, and unseen by anyone else', async () => {
    const setId = await openSet('Access');

    await as(stranger).get(`${stationPath()}/replay-sets`).expect(404);
    await as(stranger)
      .post(`${stationPath()}/replay-sets`, { name: 'Mine' })
      .expect(404);
    await bearing(readToken).get(`${stationPath()}/replay-sets`).expect(200);
    await bearing(readToken)
      .get(`${stationPath()}/replayable-runs`)
      .expect(200);
    await bearing(readToken)
      .get(`${teamPath()}/replay-sets/${setId}/replays`)
      .expect(200);
    await bearing(readToken)
      .get(`${teamPath()}/replay-sets/${setId}/suggestions`)
      .expect(200);
    await as(stranger)
      .get(`${teamPath()}/replay-sets/${setId}/suggestions`)
      .expect(404);

    const forbidden = await bearing(readToken)
      .post(`${stationPath()}/replay-sets`, { name: 'Read only' })
      .expect(403);
    expect(forbidden.body.permission).toBe('plan');

    await bearing(planToken)
      .post(`${stationPath()}/replay-sets`, { name: 'Planned' })
      .expect(201);
    await owner()
      .post(`${stationPath()}/replay-sets`, { name: '' })
      .expect(422);
    await owner()
      .get(
        `${teamPath()}/lines/${DELIVERY}/stations/${randomUUID()}/replay-sets`,
      )
      .expect(404);
  });
});

describe('a candidate', () => {
  it('is checked as the line resource checks a station, and fingerprinted as runs are', async () => {
    const candidates = app.get<ReplayCandidatesPort>(REPLAY_CANDIDATES);
    const live = await candidates.live(DELIVERY, BUILD);

    expect(live?.station.key).toBe('build');
    expect(live?.fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const wrongKey = await candidates.examine(DELIVERY, BUILD, {
      ...live?.station,
      key: 'ship',
    });
    const badHarness = await candidates.examine(DELIVERY, BUILD, {
      ...live?.station,
      harness: 'no-such-harness',
    });
    const badPrompt = await candidates.examine(DELIVERY, BUILD, {
      ...live?.station,
      prompt: 42,
    });

    for (const [examined, at] of [
      [wrongKey, 'station.key'],
      [badHarness, 'station.harness'],
      [badPrompt, 'station.prompt'],
    ] as const) {
      expect(examined?.ok).toBe(false);
      expect(
        examined && !examined.ok
          ? examined.problems.map((each) => each.field.rendered)
          : [],
      ).toContain(at);
    }

    const changed = await candidates.examine(DELIVERY, BUILD, {
      ...live?.station,
      prompt: 'Build it, then drain the queue.',
    });
    expect(changed?.ok && changed.fingerprint).not.toBe(live?.fingerprint);
    expect(changed?.ok && changed.live).toBe(live?.fingerprint);
    expect(changed?.ok && changed.changes).toEqual([
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
    ]);
    expect(await candidates.examine(DELIVERY, BUILD, live?.station)).toEqual({
      ok: true,
      fingerprint: live?.fingerprint,
      digests: live?.digests,
      liveDigests: live?.digests,
      live: live?.fingerprint,
      changes: [],
      scoring: { checksChanges: false, judge: null, rubricVersion: null },
      station: live?.station,
    });
    expect(
      changed?.ok && { ...changed.station, prompt: live?.station.prompt },
    ).toEqual(live?.station);
    expect(live?.scoring).toEqual({
      checksChanges: false,
      judge: null,
      rubricVersion: null,
    });
  });
});

const proposed = async (prompt: string): Promise<string> => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, BUILD);
  const answer = await http()
    .post(`/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({
      name: `Shorter prompt ${randomUUID().slice(0, 8)}`,
      station: { ...live?.station, prompt },
    });

  expect(answer.status).toBe(201);

  return answer.body.id as string;
};

describe('a replay', () => {
  it('replays a set under a candidate beside a baseline of the live config, two runs of the team at a time, and compares them task by task', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const setId = await openSet('Compared', first, second);
    const candidate = await proposed('Build it, then drain the queue.');

    const { id, baselineId } = await startReplay(setId, candidate, 5);
    expect(baselineId).not.toBeNull();
    await eventually(
      async () => (await replayRow(baselineId as string)) !== undefined,
    );

    const both = [id, baselineId as string];

    await dispatched();
    expect(await replayRunsOf(both)).toHaveLength(2);
    await dispatched();
    expect(await replayRunsOf(both)).toHaveLength(2);

    for (let round = 0; round < 2; round += 1) {
      const handed = [await claimed(), await claimed()];

      for (const each of handed) {
        const [entry] = await db
          .select()
          .from(schema.replayEntry)
          .where(eq(schema.replayEntry.runId, each.runId));
        const ofCandidate = entry?.replayId === id;
        const failsAt = ofCandidate && entry?.originalRunId === second.runId;

        expect((await runRow(each.runId))?.replayOfRunId).toBe(
          entry?.originalRunId,
        );
        await finishes(each, ofCandidate ? 0.1 : 0.2, failsAt);
        await settledRun(each.runId);
      }

      await dispatched();
    }

    await eventually(
      async () =>
        (await replayRow(id))?.state === 'finished' &&
        (await replayRow(baselineId as string))?.state === 'finished',
    );

    const listed = (
      await owner()
        .get(`${teamPath()}/replay-sets/${setId}/replays`)
        .expect(200)
    ).body as {
      id: string;
      isBaseline: boolean;
      candidate: { kind: string; fingerprint: string };
      totals: { completed: number; failed: number; spent: { amount: number } };
    }[];
    const baseline = listed.find((each) => each.id === baselineId);
    const replayed = listed.find((each) => each.id === id);

    expect(baseline?.isBaseline).toBe(true);
    expect(baseline?.candidate.kind).toBe('live');
    expect(
      (await runRow((await replayRunsOf([baselineId as string]))[0] ?? ''))
        ?.stationFingerprint,
    ).toBe(baseline?.candidate.fingerprint);
    expect(baseline?.totals.completed).toBe(2);
    expect(replayed?.isBaseline).toBe(false);
    expect(replayed?.totals.completed).toBe(1);
    expect(replayed?.totals.failed).toBe(1);
    expect(replayed?.totals.spent.amount).toBeCloseTo(0.2);

    const detail = (
      await owner().get(`${teamPath()}/replays/${id}`).expect(200)
    ).body as {
      baselineReplayId: string;
      comparison: {
        originalRunId: string;
        regressed: boolean;
        costDelta: number | null;
        candidate: { result: string }[];
        baseline: { result: string }[];
      }[];
    };

    expect(detail.baselineReplayId).toBe(baselineId);
    expect(
      detail.comparison.map((each) => [
        each.originalRunId,
        each.candidate[0]?.result,
        each.baseline[0]?.result,
        each.regressed,
      ]),
    ).toEqual([
      [first.runId, 'unscored', 'unscored', false],
      [second.runId, 'failed', 'unscored', false],
    ]);
    expect(detail.comparison[0]?.costDelta).toBeCloseTo(-0.1);

    const ran = (await owner().get(`${teamPath()}/replays/${id}`).expect(200))
      .body as { entries: { runId: string; fingerprint: string | null }[] };
    for (const entry of ran.entries) {
      expect(entry.fingerprint).toBe(
        (await runRow(entry.runId))?.stationFingerprint,
      );
    }
  });

  it('tells each replay run what it replays, under which candidate, and what it did and spent', async () => {
    const original = await anOriginal();
    const setId = await openSet('Read back', original);
    const candidate = await proposed('Build it, and say what you drained.');
    const { id, baselineId } = await startReplay(setId, candidate, 5);
    await eventually(
      async () => (await replayRow(baselineId as string)) !== undefined,
    );

    await dispatched();
    for (const each of [await claimed(), await claimed()]) {
      await finishes(each, 0.3);
      await settledRun(each.runId);
    }

    const [runId] = await replayRunsOf([id]);
    const replayRun = (
      await owner().get(`${teamPath()}/replay-runs/${runId}`).expect(200)
    ).body as {
      id: string;
      state: string;
      station: { id: string } | null;
      original: { runId: string; taskId: string; title: string };
      spend: { cost: number; currency: string } | null;
      journals: { runId: string }[];
      briefing: string;
      agent: { harness: string; model: string | null; effort: string | null };
      repositories: string[];
    };

    expect(replayRun.id).toBe(runId);
    expect(replayRun.state).toBe('completed');
    expect(replayRun.station?.id).toBe(BUILD);
    expect(replayRun.original).toEqual({
      runId: original.runId,
      taskId: original.taskId,
      title: `Drain queue ${original.runId.slice(0, 4)}`,
    });
    expect(replayRun.spend).toMatchObject({ cost: 0.3, currency: 'USD' });
    expect(replayRun.journals.map((each) => each.runId)).toEqual([runId]);

    const [stored] = await db
      .select({ spec: schema.run.spec })
      .from(schema.run)
      .where(eq(schema.run.id, runId));

    expect(replayRun.briefing).toBe(
      (stored?.spec as { briefing: string } | undefined)?.briefing,
    );
    expect(replayRun.agent.harness).toBe('claude-code');
    expect(replayRun.repositories).toEqual(['acme/api']);

    const ofRun = (
      await owner().get(`${teamPath()}/replay-runs/${runId}/replay`).expect(200)
    ).body as {
      replayId: string;
      setId: string;
      setName: string;
      candidate: { id: string };
      isBaseline: boolean;
      entry: { runId: string; originalRunId: string };
    };

    expect(ofRun).toMatchObject({
      replayId: id,
      setId,
      setName: 'Read back',
      candidate: { id: candidate },
      isBaseline: false,
      entry: { runId, originalRunId: original.runId },
    });

    const config = (
      await owner().get(`${teamPath()}/runs/${runId}/config`).expect(200)
    ).body as { fingerprint: string | null; changedSince: unknown };

    expect(config.fingerprint).toBe(
      (await runRow(runId ?? ''))?.stationFingerprint,
    );
    expect(config.changedSince).toBeNull();

    const compared = (
      await owner().get(`${teamPath()}/replays/${id}`).expect(200)
    ).body as { comparison: { title: string | null }[] };

    expect(compared.comparison.map((each) => each.title)).toEqual([
      `Drain queue ${original.runId.slice(0, 4)}`,
    ]);

    const outsider = randomUUID();
    await db.insert(schema.user).values({
      id: outsider,
      name: 'Oli',
      email: `${outsider}@example.com`,
    });
    await db.insert(schema.workspaceMember).values({
      workspaceId: team.workspaceId.value,
      userId: outsider,
      role: 'member',
    });

    await bearing(readToken)
      .get(`${teamPath()}/replay-runs/${runId}`)
      .expect(200);
    await as(outsider).get(`${teamPath()}/runs/${runId}/config`).expect(404);
    await owner().get(`${teamPath()}/runs/${runId}/config`).expect(200);
    await as(outsider).get(`${teamPath()}/replay-runs/${runId}`).expect(404);
    await as(outsider).get(`/api/runs/${runId}/stream`).expect(404);
    await as(outsider)
      .get(`${teamPath()}/replay-runs/${runId}/replay`)
      .expect(404);
    await as(stranger).get(`${teamPath()}/replay-runs/${runId}`).expect(404);
    await as(stranger)
      .get(`${teamPath()}/replay-runs/${runId}/replay`)
      .expect(404);
    await owner()
      .get(`${teamPath()}/replay-runs/${original.runId}`)
      .expect(404);
    await owner()
      .get(`${teamPath()}/replay-runs/${original.runId}/replay`)
      .expect(404);
  });

  it('stops dispatching once it has spent its ceiling, withdrawing what was queued while running runs finish', async () => {
    const setId = await openSet(
      'Budget',
      await anOriginal(),
      await anOriginal(),
      await anOriginal(),
    );
    const { id, baselineId } = await startReplay(setId, 'live', 0.5);
    expect(baselineId).toBe(id);

    await dispatched();
    const [one, two] = [await claimed(), await claimed()];

    await finishes(one, 0.4);
    await settledRun(one.runId);
    await dispatched();

    const [, , third] = await entriesOf(id);
    expect(third?.runId).not.toBeNull();
    expect((await runRow(third?.runId ?? ''))?.state).toBe('queued');

    await finishes(two, 0.4);
    await settledRun(two.runId);

    await eventually(async () => {
      const entries = await entriesOf(id);
      return entries[2]?.outcome === 'withdrawn';
    });

    const row = await replayRow(id);
    expect(row?.state).toBe('over-budget');
    expect((await runRow(third?.runId ?? ''))?.state).not.toBe('queued');

    const detail = (
      await owner().get(`${teamPath()}/replays/${id}`).expect(200)
    ).body as {
      state: string;
      totals: { spent: { amount: number }; completed: number; stopped: number };
    };
    expect(detail.state).toBe('over-budget');
    expect(detail.totals.spent.amount).toBeCloseTo(0.8);
    expect(detail.totals.completed).toBe(2);
    expect(detail.totals.stopped).toBe(1);
  });

  it('is stopped by a person: nothing more starts, its runs stop, and its set may then be deleted, letting go of the archives', async () => {
    const setId = await openSet(
      'Stopped',
      await anOriginal(),
      await anOriginal(),
      await anOriginal(),
    );
    const { id } = await startReplay(setId, 'live', 5);

    await dispatched();
    const running = await claimed();
    const [, queued] = (await entriesOf(id)).map((each) => each.runId);

    await owner().delete(`${teamPath()}/replay-sets/${setId}`).expect(409);
    await bearing(readToken)
      .post(`${teamPath()}/replays/${id}/stop`)
      .expect(403);
    await owner().post(`${teamPath()}/replays/${id}/stop`).expect(204);

    await eventually(
      async () =>
        (await runRow(running.runId))?.stopRequestedAt !== null &&
        (await runRow(queued ?? ''))?.state !== 'queued',
    );
    expect((await replayRow(id))?.state).toBe('stopped');
    await owner().post(`${teamPath()}/replays/${id}/stop`).expect(409);

    await finishes(running, 0.1);
    await settledRun(running.runId);
    await dispatched();
    expect(
      (await entriesOf(id)).filter((each) => each.runId !== null),
    ).toHaveLength(2);

    await owner().delete(`${teamPath()}/replay-sets/${setId}`).expect(204);
    await eventually(async () => {
      const startingPointHolds = await db
        .select()
        .from(schema.startingPointHold)
        .where(and(eq(schema.startingPointHold.holder, `replay-set:${setId}`)));
      return startingPointHolds.length === 0;
    });
    await eventually(async () => (await replayRow(id)) === undefined);
  });

  it('replays each run as many times as asked, rating each task by the mean of its copies with an interval, and measures the set’s noise', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const setId = await openSet('Repeated', first, second);
    const started = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate: 'live',
          ceiling: { amount: 5, currency: 'USD' },
          repeats: 2,
        })
        .expect(201)
    ).body as { id: string; baseline: { id: string } | null };

    expect(started.baseline?.id).toBe(started.id);
    expect(
      (await entriesOf(started.id)).map((each) => [
        each.originalRunId,
        each.repeat,
      ]),
    ).toEqual([
      [first.runId, 1],
      [second.runId, 1],
      [first.runId, 2],
      [second.runId, 2],
    ]);

    await dispatched();
    for (let round = 0; round < 2; round += 1) {
      const handed = [await claimed(), await claimed()];

      for (const each of handed) {
        const [entry] = await db
          .select()
          .from(schema.replayEntry)
          .where(eq(schema.replayEntry.runId, each.runId));

        await finishes(
          each,
          0.1,
          (entry?.originalRunId === first.runId && entry?.repeat === 1) ||
            (entry?.originalRunId === second.runId && entry?.repeat === 2),
        );
        await settledRun(each.runId);
      }

      await dispatched();
    }

    await eventually(
      async () => (await replayRow(started.id))?.state === 'finished',
    );

    const detail = (
      await owner().get(`${teamPath()}/replays/${started.id}`).expect(200)
    ).body as {
      repeats: number;
      entries: { repeat: number }[];
      totals: {
        entries: number;
        scored: number;
        succeeded: number;
        unscored: number;
        tasks: number;
        tasksScored: number;
        successRate: number;
        interval: { rate: number; low: number; high: number } | null;
      };
      againstBaseline: unknown;
    };

    expect(detail.repeats).toBe(2);
    expect(detail.entries.map((each) => each.repeat)).toEqual([1, 1, 2, 2]);
    expect(detail.totals).toMatchObject({
      entries: 4,
      scored: 2,
      succeeded: 0,
      unscored: 2,
      tasks: 2,
      tasksScored: 2,
      successRate: 0,
    });
    expect(detail.totals.interval).toEqual({ rate: 0, low: 0, high: 0 });
    expect(detail.againstBaseline).toBeNull();

    const sets = (await owner().get(`${stationPath()}/replay-sets`).expect(200))
      .body as {
      id: string;
      minGain: number;
      health: {
        noise: {
          replayId: string;
          repeats: number;
          perRepeat: number[];
          spread: number;
          flippedTasks: string[];
          noisyInOneCopy: boolean;
        } | null;
      };
    }[];

    expect(sets.find((each) => each.id === setId)).toMatchObject({
      minGain: 0.05,
      health: {
        noise: {
          replayId: started.id,
          repeats: 2,
          perRepeat: [0, 0],
          spread: 0,
          flippedTasks: [],
          noisyInOneCopy: false,
        },
      },
    });
  });

  it('is proposed, started, read and stopped through tokens that may plan or read, each write audited with its token', async () => {
    const setId = await openSet('Through tokens', await anOriginal());
    const live = await app
      .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
      .live(DELIVERY, BUILD);
    const proposedBy = (token: string) =>
      http()
        .post(
          `/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`,
        )
        .set('Authorization', `Bearer ${token}`)
        .set('Spotlight-Client', 'cli/0.4.2')
        .set('Idempotency-Key', randomUUID())
        .send({
          name: `Through tokens ${randomUUID().slice(0, 8)}`,
          station: { ...live?.station, prompt: 'Build it, through a token.' },
        });

    await proposedBy(readToken).expect(403);
    const candidate = (await proposedBy(planToken).expect(201)).body as {
      id: string;
      version: number;
      stationId: string;
    };
    expect(candidate.stationId).toBe(BUILD);

    const atBuild = (
      await bearing(readToken)
        .get(`${teamPath()}/replay-sets?line=${DELIVERY}&station=build`)
        .expect(200)
    ).body as { id: string; stationId: string }[];
    expect(atBuild.map((each) => each.id)).toContain(setId);
    expect(new Set(atBuild.map((each) => each.stationId))).toEqual(
      new Set([BUILD]),
    );
    expect(
      (
        await bearing(readToken)
          .get(`${teamPath()}/replay-sets?line=${DELIVERY}&station=ship`)
          .expect(200)
      ).body.map((each: { id: string }) => each.id),
    ).not.toContain(setId);
    await bearing(readToken)
      .get(`${teamPath()}/replay-sets?line=${DELIVERY}`)
      .expect(422);

    const started = (
      await http()
        .post(`${teamPath()}/replay-sets/${setId}/replays`)
        .set('Authorization', `Bearer ${planToken}`)
        .set('Spotlight-Client', 'cli/0.4.2')
        .send({
          candidate: candidate.id,
          ceiling: { amount: 3, currency: 'USD' },
        })
        .expect(201)
    ).body as { id: string };

    await bearing(readToken)
      .get(`${teamPath()}/replays/${started.id}`)
      .expect(200);
    await http()
      .delete(`/api/resources/replay-candidates/${candidate.id}`)
      .set('Authorization', `Bearer ${planToken}`)
      .set('If-Match', `"${candidate.version}"`)
      .expect(409);
    await http()
      .post(`${teamPath()}/replays/${started.id}/stop`)
      .set('Authorization', `Bearer ${planToken}`)
      .set('Spotlight-Client', 'cli/0.4.2')
      .expect(204);

    const audited = await db
      .select()
      .from(schema.configurationChange)
      .where(
        inArray(schema.configurationChange.resourceId, [
          candidate.id,
          started.id,
        ]),
      );

    expect(
      audited
        .sort((a, b) => a.seq - b.seq)
        .map((each) => [each.resource, each.action, each.actor, each.client]),
    ).toEqual([
      ['replay-candidate', 'created', 'token', 'cli/0.4.2'],
      ['replay', 'created', 'token', 'cli/0.4.2'],
      ['replay', 'updated', 'token', 'cli/0.4.2'],
    ]);
    expect(audited.find((each) => each.resource === 'replay')?.details).toEqual(
      {
        set: setId,
        candidate: candidate.id,
        baseline: false,
        ceiling: '3 USD',
        repeats: 1,
        probe: false,
      },
    );
  });
});

describe('a replay set whose station leaves its line', () => {
  it('is still listed for the team, lets go of its archives, starts nothing, and may be deleted', async () => {
    const original = await anOriginal({ stationId: POLISH });
    const setId = await openSetAt(POLISH, 'Reviewed', original);
    const startingPointHoldsOf = () =>
      db
        .select()
        .from(schema.startingPointHold)
        .where(eq(schema.startingPointHold.holder, `replay-set:${setId}`));

    await eventually(async () => (await startingPointHoldsOf()).length === 1);

    const { id: replayId } = await startReplay(setId, 'live', 1);
    await dispatched();
    const [replayRun] = await replayRunsOf([replayId]);
    expect(replayRun).toBeDefined();
    await owner().post(`${teamPath()}/replays/${replayId}/stop`).expect(204);

    const line = (
      await owner().get(`/api/resources/lines/${DELIVERY}`).expect(200)
    ).body as {
      version: number;
      definition: { stations: { key: string; passesTo: string[] }[] };
    };
    await owner()
      .put(`/api/resources/lines/${DELIVERY}`)
      .set('If-Match', `"${line.version}"`)
      .send({
        ...line.definition,
        stations: line.definition.stations.filter(
          (each) => each.key !== 'polish',
        ),
      })
      .expect(200);

    await eventually(async () => {
      const sets = (await owner().get(`${teamPath()}/replay-sets`).expect(200))
        .body as { id: string; stationGone: boolean }[];
      return sets.find((each) => each.id === setId)?.stationGone === true;
    });
    await eventually(async () => (await startingPointHoldsOf()).length === 0);

    expect((await runRow(replayRun as string))?.stationId).toBeNull();

    const otherTeam = randomUUID();
    const otherReader = randomUUID();
    await db.insert(schema.user).values({
      id: otherReader,
      name: 'Tam',
      email: `${otherReader}@example.com`,
    });
    await db.insert(schema.workspaceMember).values({
      workspaceId: team.workspaceId.value,
      userId: otherReader,
      role: 'member',
    });
    await db.insert(schema.team).values({
      id: otherTeam,
      workspaceId: team.workspaceId.value,
      key: `other-${otherTeam.slice(0, 8)}`,
      name: 'Other',
    });
    await db
      .insert(schema.teamMember)
      .values({ teamId: otherTeam, userId: otherReader });

    for (const path of [
      `/api/teams/${otherTeam}/replay-runs/${replayRun}`,
      `/api/teams/${otherTeam}/runs/${replayRun}/config`,
      `/api/runs/${replayRun}/stream`,
    ]) {
      await as(otherReader).get(path).expect(404);
    }
    await owner().get(`${teamPath()}/replay-runs/${replayRun}`).expect(200);
    await owner().get(`${teamPath()}/runs/${replayRun}/config`).expect(200);

    await owner()
      .get(`${stationPath(POLISH)}/replay-sets`)
      .expect(404);
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/replays`, {
        candidate: 'live',
        ceiling: { amount: 1, currency: 'USD' },
      })
      .expect(409);
    await eventually(
      async () =>
        (await owner().delete(`${teamPath()}/replay-sets/${setId}`)).status ===
        204,
    );
  });
});

const never = (): never => {
  throw new Error('there were no facts');
};
