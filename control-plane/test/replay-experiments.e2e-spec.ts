import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import { healthView } from '@replays/application/services/replay-views';
import { SetHealths } from '@replays/application/services/set-healths.service';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import {
  taskComparisons,
  totalsOf,
} from '@replays/domain/services/replay-results';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { keptSet, runEnded } from './support/kept-sets';
import { plannedCandidate, replayOf, startedReplay } from './support/replays';
import { deleteRunnersOf } from './support/runners';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-experiment-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'q'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const POLISH = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const DAY = 24 * 60 * 60_000;
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
let team: Awaited<ReturnType<typeof createTeam>>;
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

const owner = () => as(team.owner.value);

const at = (stationId: string) => ({
  workspaceId: team.workspaceId.value,
  stationId,
});

const teamPath = () => `/api/teams/${team.teamId.value}`;
interface Original {
  readonly taskId: string;
  readonly runId: string;
  readonly archiveId: string;
}

const anOriginal = async (
  input: {
    stationId?: string;
    startedFrom?: boolean;
    openedFrom?: string;
    originStationId?: string;
    endedAt?: Date;
  } = {},
): Promise<Original> => {
  const stationId = input.stationId ?? BUILD;
  const taskAt = stationId === POLISH ? BUILD : stationId;
  const taskId = randomUUID();
  const runId = randomUUID();
  const archiveId = randomUUID();
  const at = input.endedAt ?? new Date();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: input.openedFrom ?? 'person',
    workspaceId: team.workspaceId.value,
    stationId: taskAt,
    title: `Drain queue ${runId.slice(0, 4)}`,
    description: 'It stalls on restart.',
    originStationId: input.originStationId ?? taskAt,
    createdById: input.openedFrom ? null : team.owner.value,
    assigneeId: team.owner.value,
    finishedAt: at,
  });
  await db.insert(schema.workspaceArchive).values({
    id: archiveId,
    workspaceId: team.workspaceId.value,
    resumeKey: `task-${taskId}`,
    taskId,
    grantedToRunId: randomUUID(),
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: at,
    completedAt: at,
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
      resume: { key: `task-${taskId}` },
      startingPoint: true,
    },
    briefedTask: BriefedTask.of({
      stationId: StationId.of(stationId),
      title: 'Drain the queue',
      description: 'It stalls on restart.',
      reviewing: null,
      attachments: [],
      notes: [],
      openReviewComments: [],
    }).parts,
    briefedMemories: { briefed: [], omitted: [] },
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

const refreshedBefore = (setId: string) =>
  app.get(RefreshKeptSets).refreshBefore(ReplaySetId.of(setId));

const createSet = (...originals: Original[]) =>
  createSetAt(BUILD, ...originals);

const createSetAt = (stationId: string, ...originals: Original[]) =>
  keptSet(
    app,
    { workspaceId: team.workspaceId.value, stationId },
    originals.map((each) => each.runId),
  );

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
  await app.get(DispatchReplayRuns).processDue();
};

const claimed = async (): Promise<{ token: string; runId: string }> => {
  const assignment = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as { token: string; work: { run: { id: string } } };

  return { token: assignment.token, runId: assignment.work.run.id };
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
      handover: failed ? undefined : { next: 'ship', note: 'Done here.' },
      sessionId: 'session_1',
    })
    .expect(204);
};

const untilEnded = (runId: string) =>
  eventually(async () => {
    const [entry] = await db
      .select()
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.runId, runId));

    return entry?.result !== null && entry?.measured === true;
  });

const startReplay = (setId: string, candidate: string, amount: number) =>
  startedReplay(app, setId, { candidate, amount });

const setOf = async (stationId: string = BUILD) =>
  app.get(DrizzleReplaySetRepository).ofStation(stationId);

beforeAll(async () => {
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore),
  );
  db = app.get(DRIZZLE);
  team = await createTeam(
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
    .post(`/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ key: 'hosts', labels: ['linux'], token: POOL_TOKEN })
    .expect(201);
  await http()
    .put(`/api/hosts/${HOST}`)
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({
      bootId: 'boot_1',
      name: 'build-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          isDefault: true,
          harnesses: [{ id: 'claude-code', models: [] }],
        },
      ],
    })
    .expect(200);
}, 60_000);

afterAll(async () => {
  await deleteRunnersOf(db, team.workspaceId.value);
  await app?.close();
});

describe('a replay set', () => {
  it('is kept for a station once a run of it ends, filled from the station’s past runs that can be replayed', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const unanchored = await anOriginal({ startedFrom: false });
    const elsewhere = await anOriginal({ stationId: SHIP });

    await runEnded(app, at(BUILD), first.runId);
    await runEnded(app, at(BUILD), second.runId);
    await app.get(RefreshKeptSets).processDue();

    const set = await setOf();
    const runs = set?.runs.map((each) => each.value);

    expect(runs).toEqual(expect.arrayContaining([first.runId, second.runId]));
    expect(runs).not.toContain(unanchored.runId);
    expect(runs).not.toContain(elsewhere.runId);
    expect(set?.entries.every((each) => each.endedAt !== null)).toBe(true);
    expect(set?.refreshedAt).not.toBeNull();
    expect(set?.lastRefresh?.added.map((each) => each.value)).toEqual(
      expect.arrayContaining([second.runId]),
    );
    expect(await setOf(SHIP)).toBeNull();
  });

  it('is kept once for a station when several of its runs end at the same time', async () => {
    await Promise.all(Array.from({ length: 5 }, () => runEnded(app, at(SHIP))));

    expect(
      await db
        .select()
        .from(schema.replaySet)
        .where(eq(schema.replaySet.stationId, SHIP)),
    ).toHaveLength(1);
  });

  it('lets go of a run that ended more than 90 days ago, and never takes it back', async () => {
    const retired = await anOriginal({
      endedAt: new Date(Date.now() - 100 * DAY),
    });
    const kept = await anOriginal();
    const setId = await createSet(retired, kept);
    const runsOfSet = async () =>
      (await setOf())?.runs.map((each) => each.value);

    expect(await refreshedBefore(setId)).toBe(true);
    expect(await runsOfSet()).not.toContain(retired.runId);
    expect(await runsOfSet()).toContain(kept.runId);
    expect(
      (await setOf())?.lastRefresh?.removed.map((each) => each.value),
    ).toEqual([retired.runId]);

    expect(await refreshedBefore(setId)).toBe(true);
    expect(await runsOfSet()).not.toContain(retired.runId);
  });

  it('takes a run whose task was deleted as one that can no longer be replayed', async () => {
    const original = await anOriginal();

    await createSet(original);
    await db.delete(schema.task).where(eq(schema.task.id, original.taskId));

    const [summary] = await app
      .get<WorkPort>(WORK)
      .runSummaries(team.workspaceId, [RunId.of(original.runId)]);

    expect(summary?.unreplayableReason).toBe('task-gone');
  });

  it('keeps the archives its runs started from while it holds them, and releases them once the set lets go of the run', async () => {
    const original = await anOriginal();
    const setId = await createSet(original);
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

    await createSet(await anOriginal());

    await eventually(async () => (await due()) !== undefined);

    const facts = (await due())?.facts;
    expect(facts?.pinned).toBe(false);
    expect(
      (await archives.find(archiveId))?.removableAt(at, facts ?? never()),
    ).toBe(true);
    expect((await setOf())?.includes(RunId.of(original.runId))).toBe(false);
  });
});

describe('a candidate', () => {
  it('is checked as the line resource checks a station, and fingerprinted as runs are', async () => {
    const candidates = app.get<ReplayCandidatesPort>(REPLAY_CANDIDATES);
    const live = await candidates.live(DELIVERY, BUILD);

    expect(live?.station.key).toBe('build');
    expect(live?.fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const wrongKey = await candidates.validate(DELIVERY, BUILD, {
      ...live?.station,
      key: 'ship',
    });
    const badHarness = await candidates.validate(DELIVERY, BUILD, {
      ...live?.station,
      harness: 'no-such-harness',
    });
    const badPrompt = await candidates.validate(DELIVERY, BUILD, {
      ...live?.station,
      prompt: 42,
    });

    for (const [validated, at] of [
      [wrongKey, 'station.key'],
      [badHarness, 'station.harness'],
      [badPrompt, 'station.prompt'],
    ] as const) {
      expect(validated?.ok).toBe(false);
      expect(
        validated && !validated.ok
          ? validated.problems.map((each) => each.field.rendered)
          : [],
      ).toContain(at);
    }

    const changed = await candidates.validate(DELIVERY, BUILD, {
      ...live?.station,
      prompt: 'Build it, then drain the queue.',
    });
    expect(changed?.ok && changed.fingerprint).not.toBe(live?.fingerprint);
    expect(changed?.ok && changed.live).toBe(live?.fingerprint);
    expect(changed?.ok && changed.changes).toEqual([
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
    ]);
    expect(await candidates.validate(DELIVERY, BUILD, live?.station)).toEqual({
      ok: true,
      fingerprint: live?.fingerprint,
      hashes: live?.hashes,
      liveHashes: live?.hashes,
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

  return plannedCandidate(app, DELIVERY, 'build', {
    ...live?.station,
    prompt,
  });
};

describe('a replay', () => {
  it('replays a set under a candidate beside a baseline of the live config, two runs of the team at a time, and compares them task by task', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const setId = await createSet(first, second);
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
      const assignments = [await claimed(), await claimed()];

      for (const each of assignments) {
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
        await untilEnded(each.runId);
      }

      await dispatched();
    }

    await eventually(
      async () =>
        (await replayRow(id))?.state === 'finished' &&
        (await replayRow(baselineId as string))?.state === 'finished',
    );

    const replayed = await replayOf(app, id);
    const baseline = await replayOf(app, baselineId as string);
    const live = await app
      .get(DrizzleCandidateRepository)
      .find(baseline.candidateId);

    expect(baseline.baseline).toBe(true);
    expect(live?.kind).toBe('live');
    expect(
      (await runRow((await replayRunsOf([baselineId as string]))[0] ?? ''))
        ?.stationFingerprint,
    ).toBe(live?.fingerprint.value);
    expect(totalsOf(baseline).endings.completed).toBe(2);
    expect(replayed.baseline).toBe(false);
    expect(totalsOf(replayed).endings).toMatchObject({
      completed: 1,
      failed: 1,
    });
    expect(totalsOf(replayed).spent.amount).toBeCloseTo(0.2);
    expect(replayed.pairwiseReferenceId?.value).toBe(baselineId);

    const comparison = taskComparisons(replayed, baseline);

    expect(
      comparison.map((each) => [
        each.original,
        each.candidate[0]?.succeeded,
        each.baseline[0]?.succeeded,
        each.regressed,
      ]),
    ).toEqual([
      [first.runId, null, null, false],
      [second.runId, false, null, false],
    ]);
    expect(comparison[0]?.costDelta).toBeCloseTo(-0.1);
    for (const entry of replayed.entries) {
      expect(entry.fingerprint?.value).toBe(
        (await runRow(entry.run?.value ?? ''))?.stationFingerprint,
      );
    }
  });

  it('keeps each replay run out of the runs a person reads, while it records what it replays', async () => {
    const original = await anOriginal();
    const setId = await createSet(original);
    const candidate = await proposed('Build it, and say what you drained.');
    const { id, baselineId } = await startReplay(setId, candidate, 5);
    await eventually(
      async () => (await replayRow(baselineId as string)) !== undefined,
    );

    await dispatched();
    for (const each of [await claimed(), await claimed()]) {
      await finishes(each, 0.3);
      await untilEnded(each.runId);
    }

    const [runId] = await replayRunsOf([id]);
    const run = await runRow(runId ?? '');

    expect(run?.state).toBe('completed');
    expect(run?.replayOfRunId).toBe(original.runId);
    expect(run?.taskId).toBeNull();
    expect(
      (run?.spec as { briefing?: string } | undefined)?.briefing,
    ).toBeTruthy();

    for (const path of [
      `${teamPath()}/replay-runs/${runId}`,
      `${teamPath()}/replay-runs/${runId}/replay`,
      `${teamPath()}/runs/${runId}/notes`,
      `${teamPath()}/runs/${runId}/config`,
      `/api/runs/${runId}/stream`,
    ]) {
      await owner().get(path).expect(404);
    }
    expect(
      (
        (await owner().get(`${teamPath()}/runs`).expect(200)).body as {
          id: string;
        }[]
      ).some((each) => each.id === runId),
    ).toBe(false);
  });

  it('stops dispatching once it has spent its ceiling, cancelling what was queued while running runs finish', async () => {
    const setId = await createSet(
      await anOriginal(),
      await anOriginal(),
      await anOriginal(),
    );
    const { id, baselineId } = await startReplay(setId, 'live', 0.5);
    expect(baselineId).toBe(id);

    await dispatched();
    const [one, two] = [await claimed(), await claimed()];

    await finishes(one, 0.4);
    await untilEnded(one.runId);
    await dispatched();

    const [, , third] = await entriesOf(id);
    expect(third?.runId).not.toBeNull();
    expect((await runRow(third?.runId ?? ''))?.state).toBe('queued');

    await finishes(two, 0.4);
    await untilEnded(two.runId);

    await eventually(async () => {
      const entries = await entriesOf(id);
      return entries[2]?.result === 'cancelled';
    });

    const row = await replayRow(id);
    expect(row?.state).toBe('ceiling-reached');
    expect((await runRow(third?.runId ?? ''))?.state).not.toBe('queued');

    const capped = await replayOf(app, id);

    expect(capped.current).toBe('ceiling-reached');
    expect(totalsOf(capped).spent.amount).toBeCloseTo(0.8);
    expect(totalsOf(capped).endings).toMatchObject({
      completed: 2,
      stopped: 1,
    });
  });

  it('replays each run as many times as requested, rating each task by the mean of its repeats with an interval, and measures the set’s noise', async () => {
    const first = await anOriginal();
    const second = await anOriginal();
    const setId = await createSet(first, second);
    const started = await startedReplay(app, setId, {
      candidate: 'live',
      amount: 5,
      repeats: 2,
    });

    expect(started.baselineId).toBe(started.id);
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
      const assignments = [await claimed(), await claimed()];

      for (const each of assignments) {
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
        await untilEnded(each.runId);
      }

      await dispatched();
    }

    await eventually(
      async () => (await replayRow(started.id))?.state === 'finished',
    );

    const repeated = await replayOf(app, started.id);
    const totals = totalsOf(repeated);

    expect(repeated.repeats).toBe(2);
    expect(repeated.entries.map((each) => each.repeat)).toEqual([1, 1, 2, 2]);
    expect(totals).toMatchObject({
      entries: 4,
      scored: 2,
      succeeded: 0,
      unscored: 2,
      tasks: 2,
      tasksScored: 2,
      successRate: 0,
    });
    expect(totals.interval).toEqual({ rate: 0, low: 0, high: 0 });

    const set = (await setOf()) as ReplaySet;
    const healths = app.get(SetHealths);
    const standard = await healths.standardAt(set.station);

    expect(standard.minGain).toBe(0.05);
    expect(healthView(await healths.ofSet(set, standard)).noise).toMatchObject({
      replayId: started.id,
      repeats: 2,
      perRepeat: [0, 0],
      spread: 0,
      flippedTasks: [],
      noisyInOneRepeat: false,
    });
  });
});

describe('a replay set whose station leaves its line', () => {
  it('is kept, releases its archives, starts nothing and is never refreshed', async () => {
    const original = await anOriginal({ stationId: POLISH });
    const setId = await createSetAt(POLISH, original);
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
    await app.get<TransactionPort>(TRANSACTION).inTransaction(async () => {
      const replays = app.get(DrizzleReplayRepository);
      const replay = await replays.find(ReplayId.of(replayId));

      await replays.save(
        (replay as Replay).stop(
          new Date(),
          ChangeActor.spotlight(team.workspaceId),
        ),
      );
    });

    const line = (
      await owner().get(`/api/v1/resources/lines/${DELIVERY}`).expect(200)
    ).body as {
      version: number;
      definition: { stations: { key: string; passesTo: string[] }[] };
    };
    await owner()
      .put(`/api/v1/resources/lines/${DELIVERY}`)
      .set('If-Match', `"${line.version}"`)
      .send({
        ...line.definition,
        stations: line.definition.stations.filter(
          (each) => each.key !== 'polish',
        ),
      })
      .expect(200);

    await eventually(
      async () =>
        (await app.get(DrizzleReplaySetRepository).find(ReplaySetId.of(setId)))
          ?.isAtGoneStation === true,
    );
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
      `/api/teams/${otherTeam}/runs/${replayRun}/config`,
      `/api/runs/${replayRun}/stream`,
    ]) {
      await as(otherReader).get(path).expect(404);
    }
    await owner().get(`${teamPath()}/replay-runs/${replayRun}`).expect(404);
    await owner().get(`${teamPath()}/runs/${replayRun}/config`).expect(404);

    await expect(startReplay(setId, 'live', 1)).rejects.toThrow();
    expect(await refreshedBefore(setId)).toBe(false);
  });
});

describe('a team that is deleted', () => {
  it('loses its kept replay sets, and their archives are released', async () => {
    const original = await anOriginal();
    const setId = await createSet(original);
    const holdsOf = () =>
      db
        .select()
        .from(schema.startingPointHold)
        .where(eq(schema.startingPointHold.holder, `replay-set:${setId}`));

    await eventually(async () =>
      (await holdsOf()).some((each) => each.runIds.includes(original.runId)),
    );

    const deleted: TeamDeletedIntegrationEvent = {
      kind: TEAM_DELETED,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      key: 'core',
    };
    await app.get(EventOutbox).record([deleted as unknown as DomainEvent]);

    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);

      const sets = await db
        .select()
        .from(schema.replaySet)
        .where(eq(schema.replaySet.teamId, team.teamId.value));
      const holds = await holdsOf();

      return (
        sets.length === 0 && holds.every((each) => each.runIds.length === 0)
      );
    }, 60_000);
  });
});

const never = (): never => {
  throw new Error('there were no facts');
};
