import { randomUUID } from 'node:crypto';
import { JUDGE, type JudgePort } from '@insights/application/ports/judge.port';
import { WorkChangeJudgings } from '@insights/application/services/work-change-judgings.service';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { baselineOf } from '@replays/domain/services/baseline';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
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
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, isNotNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { keptSet } from './support/kept-sets';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOST = `host-replay-insights-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'f'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const POLISH = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const RUBRIC = 'scores: 1-5\nDoes it drain the queue in order?';
const SCORED = /score\((\d)\)/;
const WITHIN = 60_000;

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

const judge: JudgePort = {
  available: true,
  model: 'stub/judge',
  judge: async (request) => {
    const scoredStep = request.steps.find((each) => SCORED.test(each.text));
    const value = Number(SCORED.exec(scoredStep?.text ?? '')?.[1] ?? 1);

    return {
      guidance: null,
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        cost: { amount: 0.01, currency: 'USD' },
      },
      verdict: {
        value,
        reasons: [
          {
            text: `It drains the queue as a ${value}.`,
            steps: scoredStep ? [scoredStep.index] : [],
            hunks: [],
          },
        ],
      },
    };
  },
};

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const http = () => served(app);

const owner = () => ({
  get: (path: string) =>
    http().get(path).set(TEST_USER_HEADER, team.owner.value),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set(TEST_USER_HEADER, team.owner.value)
      .send(body ?? {}),
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

const teamPath = () => `/api/teams/${team.teamId.value}`;
const stationPath = (stationId = BUILD) =>
  `${teamPath()}/lines/${DELIVERY}/stations/${stationId}`;

interface Original {
  readonly taskId: string;
  readonly runId: string;
}

const anOriginal = async (stationId = BUILD): Promise<Original> => {
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
    originStationId: BUILD,
    createdById: team.owner.value,
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
      handover: { options: ['ship'], noteLimit: 0 },
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
    startedFromArchiveId: archiveId,
    startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
    startedFromAttempt: 1,
    startedFromAt: at,
  });

  return { taskId, runId };
};

const createSet = (
  originals: readonly Original[],
  stationId = BUILD,
): Promise<string> =>
  keptSet(
    app,
    { workspaceId: team.workspaceId.value, stationId },
    originals.map((each) => each.runId),
  );

interface Budget {
  readonly iterations: number;
  readonly perIteration: number;
  readonly ceiling: number;
  readonly concurrency?: number;
}

const budgetOf = (budget: Budget) => ({
  iterations: budget.iterations,
  perIteration: budget.perIteration,
  ceiling: { amount: budget.ceiling, currency: 'USD' },
  concurrency: budget.concurrency ?? 10,
});

const startSearch = async (
  setId: string,
  budget: Budget,
  stationId = BUILD,
): Promise<{ id: string; seedReplayId: string }> =>
  (
    await owner()
      .post(`${stationPath(stationId)}/searches`, {
        setId,
        agent: { harness: 'claude-code', model: null, effort: 'high' },
        budget: budgetOf(budget),
      })
      .expect(201)
  ).body as { id: string; seedReplayId: string };

interface SearchRead {
  state: string;
  stopReason: string | null;
  spent: { amount: number };
  split: {
    searched: { runId: string; taskId: string }[];
    heldOut: { runId: string; taskId: string }[];
  };
  iterations: { number: number; runId: string; state: string }[];
  seed: {
    candidateId: string;
    heldOutScore: number | null;
    searchScore: number | null;
    searchScored: number;
    costPerRun: number | null;
  };
  candidates: {
    candidateId: string;
    name: string;
    replayId: string;
    heldOutReplayId: string | null;
    searchScore: number | null;
    searchScored: number;
    heldOutScore: number | null;
    costPerRun: number | null;
    onFrontier: boolean;
  }[];
  frontier: string[];
  best: { name: string } | null;
}

const searchOf = async (id: string): Promise<SearchRead> =>
  (await owner().get(`${teamPath()}/searches/${id}`).expect(200))
    .body as SearchRead;

const searchRow = async (id: string) => {
  const [row] = await db
    .select()
    .from(schema.replaySearch)
    .where(eq(schema.replaySearch.id, id));

  return row;
};

const searchState = async (id: string) => (await searchRow(id))?.state;

const replayRow = async (id: string) => {
  const [row] = await db
    .select()
    .from(schema.replay)
    .where(eq(schema.replay.id, id));

  return row;
};

const searchRunsOf = (searchId: string) =>
  db.select().from(schema.run).where(eq(schema.run.searchId, searchId));

const queuedReplayRuns = async () =>
  db
    .select({ id: schema.run.id })
    .from(schema.run)
    .where(
      and(
        eq(schema.run.workspaceId, team.workspaceId.value),
        eq(schema.run.state, 'queued'),
        isNotNull(schema.run.replayOfRunId),
      ),
    );

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

interface Claimed {
  readonly token: string;
  readonly runId: string;
}

const claimed = async (): Promise<Claimed | null> => {
  const answer = await http()
    .post('/api/hosts/claim')
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({ host: HOST, image: IMAGE });

  if (answer.status === 204) {
    return null;
  }

  expect(answer.status).toBe(200);

  const assignment = answer.body as {
    token: string;
    work: { run: { id: string } };
  };

  return { token: assignment.token, runId: assignment.work.run.id };
};

const judged = async () => {
  await app.get(WorkChangeJudgings).processDue();
  await app.get(WorkChangeJudgings).idle();
};

const finished = async (
  { token, runId }: Claimed,
  score: number,
  cost: number,
) => {
  await bearing(token)
    .post(`/api/runs/${runId}/events`, {
      events: [
        {
          seq: 1,
          type: 'output',
          at: new Date().toISOString(),
          data: sent({
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Drained it: score(${score}).` },
          }),
        },
        {
          seq: 2,
          type: 'output',
          at: new Date().toISOString(),
          data: sent({
            sessionUpdate: 'usage_update',
            used: 1_000,
            size: 200_000,
            cost: { amount: cost, currency: 'USD' },
          }),
        },
      ],
    })
    .expect(204);
  await bearing(token)
    .post(`/api/runs/${runId}/completion`, {
      exitCode: 0,
      failed: false,
      handover: { next: 'ship', note: 'Drained.' },
      sessionId: 'session_1',
      archived: true,
    })
    .expect(200);
};

const entryOf = async (runId: string) => {
  const [entry] = await db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.runId, runId));

  return entry;
};

type Plan = (replayId: string) => { score: number; cost: number };

const drained = async (plan: Plan): Promise<void> => {
  for (let turn = 0; turn < 200; turn += 1) {
    await app.get(DispatchReplayRuns).processDue();

    if ((await queuedReplayRuns()).length === 0) {
      await judged();
      return;
    }

    const assignment = await claimed();

    if (!assignment) {
      continue;
    }

    const entry = await entryOf(assignment.runId);

    if (!entry) {
      throw new Error(`claimed ${assignment.runId}, which is no replay run`);
    }

    const { score, cost } = plan(entry.replayId);

    await finished(assignment, score, cost);
    await judged();
  }

  throw new Error('the replay runs never drained');
};

const replayEnded = (replayId: string) =>
  eventually(async () => {
    await judged();
    const state = (await replayRow(replayId))?.state;

    return state !== 'queued' && state !== 'running' ? state : null;
  }, WITHIN);

const leasedSearchRun = async (
  searchId: string,
  iteration: number,
): Promise<Claimed> => {
  await eventually(async () => {
    await app.get(AdvanceSearches).processDue();
    const runs = await searchRunsOf(searchId);

    return runs.some(
      (each) => each.state === 'queued' && each.searchIteration === iteration,
    );
  }, WITHIN);

  const assignment = await claimed();
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, assignment?.runId ?? ''));

  expect(row?.searchId).toBe(searchId);

  return assignment as Claimed;
};

const endedSearchRun = async ({ token, runId }: Claimed, failed = false) => {
  await bearing(token)
    .post(`/api/runs/${runId}/events`, {
      events: [
        {
          seq: 1,
          type: 'output',
          at: new Date().toISOString(),
          data: sent({
            sessionUpdate: 'usage_update',
            used: 1_000,
            size: 200_000,
            cost: { amount: 0.05, currency: 'USD' },
          }),
        },
      ],
    })
    .expect(204);
  await bearing(token)
    .post(`/api/runs/${runId}/completion`, {
      exitCode: failed ? 1 : 0,
      failed,
      handover: failed ? undefined : { next: 'review', note: 'Proposed.' },
      sessionId: 'session_1',
      archived: true,
    })
    .expect(200);
};

const liveBlock = async () => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, BUILD);

  if (!live) {
    throw new Error('the build station is not live');
  }

  return live.station;
};

const proposing = (assignment: Claimed, body: object) =>
  bearing(assignment.token).post(
    `/api/runs/${assignment.runId}/search-candidates`,
    body,
  );

const tokenWith = async (scopes: readonly string[]): Promise<string> => {
  const issued = await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({
      name: `replayed-${scopes.join('-')}-${randomUUID().slice(0, 8)}`,
      scopes,
    });

  expect(issued.status).toBe(201);

  return issued.headers['spotlight-workspace-token'] as string;
};

let fiveTasks: Original[];

beforeAll(async () => {
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore)
      .overrideProvider(JUDGE)
      .useValue(judge),
  );
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `replay-insights-${randomUUID().slice(0, 8)}`,
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
  const judged = {
    rubric: RUBRIC,
    claims: [],
    passThreshold: 1,
    sample: 0.1,
    minAgreement: 0.6,
  };
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
      judge: judged,
    },
    {
      id: POLISH,
      lineId: DELIVERY,
      key: 'polish',
      name: 'Polish',
      position: 2,
      kind: 'work',
      harness: 'claude-code',
      agentPrompt: 'Polish it.',
      judge: judged,
    },
    {
      id: SHIP,
      lineId: DELIVERY,
      key: 'ship',
      name: 'Ship',
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
  await db.insert(schema.stationRoute).values([
    { stationId: BUILD, toStationId: SHIP },
    { stationId: POLISH, toStationId: SHIP },
  ]);

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
      bootId: 'boot_1',
      name: 'search-box',
      release: '0.1.0',
      containerRuntime: 'docker',
      capacity: 64,
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

  fiveTasks = [];
  for (let each = 0; each < 5; each += 1) {
    fiveTasks.push(await anOriginal());
  }
}, 120_000);

afterAll(async () => {
  await app?.close();
});

const replayedPath = (period?: string) =>
  `${teamPath()}/replayed-candidates${period ? `?period=${period}` : ''}`;

interface Replayed {
  period: { name: string; from: string; to: string };
  truncated: boolean;
  stations: {
    lineId: string;
    stationId: string;
    sets: {
      setId: string;
      baseline: { replayId: string } | null;
      candidates: {
        candidateId: string;
        name: string;
        kind: string;
        replayId: string;
        tasks: number;
        regressions: number | null;
        compared: number;
        successRate: number | null;
        scored: number;
        costPerRun: number | null;
        onFrontier: boolean | null;
        heldOut: { replayId: string; score: number | null } | null;
        runs: number;
        successRateOnCompared: number | null;
        search: {
          searchId: string;
          seed: {
            successRate: number | null;
            costPerRun: number | null;
            scored: number;
          };
        } | null;
      }[];
    }[];
  }[];
}

describe('replayed candidates beside live runs', () => {
  it('shows a searched candidate with the scores its search page shows, beside the baseline its replay page names', async () => {
    const setId = await createSet(fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 1,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 3, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(id, 1);
    const block = await liveBlock();
    const proposed = (
      await proposing(agent, {
        name: 'in-order',
        hypothesis: 'Draining in order stops the stall.',
        station: { ...block, prompt: 'Build it, draining in order.' },
      }).expect(201)
    ).body as { candidateId: string; replayId: string };

    await endedSearchRun(agent);
    await drained(() => ({ score: 5, cost: 0.1 }));
    expect(await replayEnded(proposed.replayId)).toBe('finished');
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(() => ({ score: 5, cost: 0.1 }));
    await eventually(async () => {
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);

    const replayed = (await owner().get(replayedPath()).expect(200))
      .body as Replayed;
    const searched = await searchOf(id);
    const candidate = searched.candidates.find(
      (each) => each.candidateId === proposed.candidateId,
    );
    const [station] = replayed.stations;
    const [set] = station?.sets ?? [];
    const shown = set?.candidates.find(
      (each) => each.candidateId === proposed.candidateId,
    );

    expect(replayed.period.name).toBe('30d');
    expect(replayed.truncated).toBe(false);
    expect(station).toMatchObject({ lineId: DELIVERY, stationId: BUILD });
    expect(set?.setId).toBe(setId);
    expect(set?.candidates).toHaveLength(1);
    expect(shown).toMatchObject({
      name: 'in-order',
      kind: 'searched',
      replayId: candidate?.replayId,
      successRate: candidate?.searchScore,
      scored: candidate?.searchScored,
      costPerRun: candidate?.costPerRun,
      onFrontier: candidate?.onFrontier,
      heldOut: {
        replayId: candidate?.heldOutReplayId,
        score: candidate?.heldOutScore,
      },
      search: {
        searchId: id,
        seed: {
          successRate: searched.seed.searchScore,
          costPerRun: searched.seed.costPerRun,
          scored: searched.seed.searchScored,
        },
      },
    });

    const replay = (
      await owner()
        .get(`${teamPath()}/replays/${proposed.replayId}`)
        .expect(200)
    ).body as { baselineReplayId: string | null };

    expect(set?.baseline?.replayId).toBe(replay.baselineReplayId);
    expect(set?.baseline?.replayId).toBe(seedReplayId);
  }, 120_000);

  it('shows a proposed candidate with the numbers its replay page shows', async () => {
    const tasks: Original[] = [];
    for (let each = 0; each < 5; each += 1) {
      tasks.push(await anOriginal());
    }
    const setId = await createSet(tasks);
    const created = await http()
      .post(`/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Drain in order',
        station: { ...(await liveBlock()), prompt: 'Build it, in order.' },
      })
      .expect(201);
    const started = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate: created.body.id,
          ceiling: { amount: 5, currency: 'USD' },
        })
        .expect(201)
    ).body as { id: string; baseline: { id: string } | null };
    const ended = [started.id, started.baseline?.id ?? ''];
    let turn = 0;

    const plan: Plan = (replayId) => {
      if (replayId !== started.id) {
        return { score: 4, cost: 0.1 };
      }

      turn += 1;

      return { score: turn % 2 === 0 ? 2 : 5, cost: 0.2 };
    };

    await eventually(async () => {
      await drained(plan);
      await judged();
      const states = await Promise.all(
        ended.map(async (each) => (await replayRow(each))?.state),
      );

      return states.every((each) => each === 'finished');
    }, WITHIN);

    const replay = (
      await owner().get(`${teamPath()}/replays/${started.id}`).expect(200)
    ).body as {
      baselineReplayId: string | null;
      totals: { entries: number; successRate: number | null; scored: number };
      comparison: { regressed: boolean; baseline: object | null }[];
    };
    const replayed = (await owner().get(replayedPath()).expect(200))
      .body as Replayed;
    const set = replayed.stations
      .flatMap((each) => each.sets)
      .find((each) => each.setId === setId);
    const shown = set?.candidates.find((each) => each.kind === 'proposed');

    expect(
      set?.candidates.filter((each) => each.kind === 'proposed'),
    ).toHaveLength(1);
    expect(shown).toMatchObject({
      candidateId: created.body.id,
      replayId: started.id,
      tasks: tasks.length,
      runs: replay.totals.entries,
      successRate: replay.totals.successRate,
      scored: replay.totals.scored,
      regressions: replay.comparison.filter((each) => each.regressed).length,
      compared: replay.comparison.filter((each) => each.baseline !== null)
        .length,
      onFrontier: null,
      search: null,
    });
    expect(set?.baseline?.replayId).toBe(replay.baselineReplayId);
    expect(set?.baseline?.replayId).not.toBeNull();
  }, 120_000);

  it('reads each set’s current baseline as the replay page picks it, past newer stopped ones', async () => {
    const replays = app.get(DrizzleReplayRepository);
    const sets = await db
      .selectDistinct({ setId: schema.replay.setId })
      .from(schema.replay)
      .where(eq(schema.replay.teamId, team.teamId.value));
    const setIds = sets.map((each) => ReplaySetId.of(each.setId));

    for (const each of await replays.baselinesOfSets(setIds)) {
      const [row] = await db
        .select()
        .from(schema.replay)
        .where(eq(schema.replay.id, each.id.value));

      await db.insert(schema.replay).values({
        ...(row as typeof schema.replay.$inferInsert),
        id: randomUUID(),
        state: 'stopped',
        startedAt: new Date(Date.now() + 60_000),
        version: 0,
      });
    }

    const read = await replays.baselinesOfSets(setIds);

    expect(read).toHaveLength(setIds.length);
    for (const setId of setIds) {
      expect(read.find((each) => each.setId.equals(setId))?.id.value).toBe(
        baselineOf(await replays.ofSet(setId))?.id.value,
      );
    }
  });

  it('looks back over the same UTC days as the team’s insights', async () => {
    for (const period of ['7d', '30d', '90d']) {
      const replayed = (await owner().get(replayedPath(period)).expect(200))
        .body as Replayed;
      const insights = (
        await owner()
          .get(`${teamPath()}/insights/changes?period=${period}`)
          .expect(200)
      ).body as { period: { from: string; to: string } };

      expect(replayed.period).toEqual({
        name: period,
        from: insights.period.from,
        to: insights.period.to,
      });
    }
  });

  it('answers a team member and a read token, and no one off the team', async () => {
    const member = randomUUID();
    await db.insert(schema.user).values({
      id: member,
      name: 'Mo',
      email: `${member}@example.com`,
    });
    await db.insert(schema.workspaceMember).values({
      workspaceId: team.workspaceId.value,
      userId: member,
      role: 'member',
    });
    await db
      .insert(schema.teamMember)
      .values({ teamId: team.teamId.value, userId: member });
    const others = await createTeam(
      db,
      app.get(DrizzleTaskRepository),
      `replay-others-${randomUUID().slice(0, 8)}`,
    );

    await http().get(replayedPath()).set(TEST_USER_HEADER, member).expect(200);
    await bearing(await tokenWith(['read']))
      .get(replayedPath('7d'))
      .expect(200);
    await http()
      .get(replayedPath())
      .set(TEST_USER_HEADER, others.owner.value)
      .expect(404);
    await owner().get(replayedPath('14d')).expect(422);
  });
});
