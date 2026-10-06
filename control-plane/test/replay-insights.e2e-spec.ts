import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  CONFIG_STRETCHES,
  type ConfigStretchesPort,
} from '@outcomes/application/ports/config-stretches.port';
import { JUDGE, type JudgePort } from '@outcomes/application/ports/judge.port';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { baselineOf } from '@replays/domain/services/baseline';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import {
  LINE_REDEFINED,
  type LineRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-redefined.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
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
import { openDatabase, type TestDatabase } from './support/database';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

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
  judge: async (ask) => {
    const said = ask.steps.find((each) => SCORED.test(each.text));
    const value = Number(SCORED.exec(said?.text ?? '')?.[1] ?? 1);

    return {
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
            steps: said ? [said.index] : [],
            hunks: [],
          },
        ],
      },
    };
  },
};

let own: TestDatabase;
let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;

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
    startedFromArchiveId: archiveId,
    startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
    startedFromAttempt: 1,
    startedFromAt: at,
  });

  return { taskId, runId };
};

const openSet = async (
  name: string,
  originals: readonly Original[],
  stationId = BUILD,
): Promise<string> => {
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
  ending: string | null;
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

  const handed = answer.body as {
    token: string;
    work: { run: { id: string } };
  };

  return { token: handed.token, runId: handed.work.run.id };
};

const judged = async () => {
  await app.get(WorkChangeJudgings).workDue();
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
      outcome: { next: 'ship', note: 'Drained.' },
      sessionId: 'session_1',
      kept: true,
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
    await app.get(DispatchReplayRuns).workDue();

    if ((await queuedReplayRuns()).length === 0) {
      await judged();
      return;
    }

    const handed = await claimed();

    if (!handed) {
      continue;
    }

    const entry = await entryOf(handed.runId);

    if (!entry) {
      throw new Error(`claimed ${handed.runId}, which is no replay run`);
    }

    const { score, cost } = plan(entry.replayId);

    await finished(handed, score, cost);
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

const heldSearchRun = async (
  searchId: string,
  iteration: number,
): Promise<Claimed> => {
  await eventually(async () => {
    await app.get(AdvanceSearches).workDue();
    const runs = await searchRunsOf(searchId);

    return runs.some(
      (each) => each.state === 'queued' && each.searchIteration === iteration,
    );
  }, WITHIN);

  const handed = await claimed();
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, handed?.runId ?? ''));

  expect(row?.searchId).toBe(searchId);

  return handed as Claimed;
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
      outcome: failed ? undefined : { next: 'review', note: 'Proposed.' },
      sessionId: 'session_1',
      kept: true,
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

const proposing = (handed: Claimed, body: object) =>
  bearing(handed.token).post(
    `/api/runs/${handed.runId}/search-candidates`,
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

const shared = process.env.DATABASE_URL;

let fiveTasks: Original[];

beforeAll(async () => {
  own = await openDatabase('replay_insights');
  process.env.DATABASE_URL = own.url;
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
  team = await openTeam(
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
    passShare: 1,
    sample: 0.1,
    trust: 0.6,
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
      session: 'session_1',
      name: 'search-box',
      release: '0.1.0',
      executor: 'docker',
      capacity: 64,
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

  fiveTasks = [];
  for (let each = 0; each < 5; each += 1) {
    fiveTasks.push(await anOriginal());
  }
}, 120_000);

afterAll(async () => {
  await app?.close();
  process.env.DATABASE_URL = shared;
  await own?.close();
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
        adoption: {
          at: string;
          live: boolean;
          creditedTo: {
            candidateId: string;
            name: string;
            withdrawn: boolean;
          } | null;
        } | null;
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
    const setId = await openSet('Replayed', fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 1,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 3, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await heldSearchRun(id, 1);
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
      await app.get(AdvanceSearches).workDue();
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
    const setId = await openSet('Proposed', fiveTasks);
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

    expect(set?.candidates).toHaveLength(1);
    expect(shown).toMatchObject({
      candidateId: created.body.id,
      replayId: started.id,
      tasks: fiveTasks.length,
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

  it('reads each set’s standing baseline as the replay page picks it, past newer stopped ones', async () => {
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
    const others = await openTeam(
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

describe('config origins', () => {
  interface Origin {
    stationId: string;
    runId: string;
    fingerprint: string;
    changedAt: string;
    candidateId: string;
    name: string;
    kind: string;
    lineId: string;
    searchId: string | null;
    replayId: string | null;
    createdAt: string;
    withdrawn: boolean;
  }

  const originsPath = () => `${teamPath()}/config-origins`;

  const proposedCandidate = async (name: string, prompt: string) => {
    const created = await http()
      .post(`/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('Idempotency-Key', randomUUID())
      .send({ name, station: { ...(await liveBlock()), prompt } })
      .expect(201);
    const [row] = await db
      .select()
      .from(schema.replayCandidate)
      .where(eq(schema.replayCandidate.id, created.body.id as string));

    if (!row) {
      throw new Error(`no candidate ${created.body.id}`);
    }

    return row;
  };

  const elsewhere = async (
    candidate: typeof schema.replayCandidate.$inferSelect,
    placed: { workspaceId?: string; teamId?: string },
  ) => {
    const fingerprint = randomUUID().replaceAll('-', '').repeat(2);

    await db.insert(schema.replayCandidate).values({
      ...candidate,
      ...placed,
      id: randomUUID(),
      name: `Elsewhere ${fingerprint.slice(0, 6)}`,
      fingerprint,
    });

    return fingerprint;
  };

  const startedWith = async (
    fingerprint: string,
    at?: Date,
    stationId = BUILD,
  ): Promise<Original & { readonly startedAt: Date }> => {
    const original = await anOriginal(stationId);
    const startedAt = at ?? new Date();

    await db
      .update(schema.run)
      .set({
        stationFingerprint: fingerprint,
        stationConfig: {
          prompt: 'Build it.',
          harness: 'claude-code',
          model: null,
          effort: null,
          profile: null,
          image: null,
          repositories: [],
          skills: [],
          tools: [],
          decisions: false,
          memories: false,
        },
        createdAt: startedAt,
        queuedAt: startedAt,
        startedAt,
        endedAt: startedAt,
      })
      .where(eq(schema.run.id, original.runId));

    return { ...original, startedAt };
  };

  const heardEnded = async (
    { taskId, runId }: Original,
    stationId = BUILD,
    outcome: 'completed' | 'failed' = 'completed',
  ): Promise<void> => {
    const ended: RunEndedIntegrationEvent = {
      kind: RUN_ENDED,
      runId,
      workspaceId: team.workspaceId.value,
      taskId,
      stationId,
      outcome,
      failure: outcome === 'failed' ? 'exited' : null,
      stopped: false,
      asked: false,
    };

    await app.get(EventOutbox).record([ended]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      const [record] = await db
        .select()
        .from(schema.runRecord)
        .where(eq(schema.runRecord.runId, runId));

      return record?.endedAt !== null && record !== undefined;
    }, WITHIN);
    await app.get(EventDelivery).drain(2_000);
  };

  interface Ran {
    readonly runId: string;
    readonly at: Date;
  }

  const ranWith = async (
    fingerprint: string,
    at?: Date,
    stationId = BUILD,
  ): Promise<Ran> => {
    const started = await startedWith(fingerprint, at, stationId);

    await heardEnded(started, stationId);

    return { runId: started.runId, at: started.startedAt };
  };

  const failedToStart = async (
    fingerprint: string,
    stationId: typeof BUILD,
  ): Promise<Ran> => {
    const started = await startedWith(fingerprint, undefined, stationId);

    await db
      .update(schema.run)
      .set({ state: 'failed', exitCode: 1, startedAt: null })
      .where(eq(schema.run.id, started.runId));
    await heardEnded(started, stationId, 'failed');

    return { runId: started.runId, at: started.startedAt };
  };

  const madeAt = async (candidateId: string, createdAt: Date) => {
    await db
      .update(schema.replayCandidate)
      .set({ createdAt })
      .where(eq(schema.replayCandidate.id, candidateId));
  };

  const askedAbout = async (
    changes: readonly { runId: string }[],
    as = owner(),
  ): Promise<Origin[]> =>
    (
      await as
        .post(originsPath(), {
          changes: changes.map((each) => ({
            stationId: BUILD,
            runId: each.runId,
          })),
        })
        .expect(200)
    ).body.origins as Origin[];

  const adoptionsShown = async () =>
    new Map(
      (
        (await owner().get(replayedPath()).expect(200)).body as Replayed
      ).stations
        .flatMap((each) => each.sets)
        .flatMap((each) => each.candidates)
        .map((each) => [each.candidateId, each.adoption] as const),
    );

  const withLivePrompt = async (
    prompt: string,
    checked: () => Promise<void>,
  ) => {
    await db
      .update(schema.station)
      .set({ agentPrompt: prompt })
      .where(eq(schema.station.id, BUILD));

    try {
      await checked();
    } finally {
      await db
        .update(schema.station)
        .set({ agentPrompt: 'Build it.' })
        .where(eq(schema.station.id, BUILD));
    }
  };

  const replayOfCandidate = async (
    candidateId: string,
    startedAt: Date,
    setId?: string,
  ) => {
    const [template] = await db
      .select()
      .from(schema.replay)
      .where(
        and(
          eq(schema.replay.teamId, team.teamId.value),
          eq(schema.replay.baseline, false),
          eq(schema.replay.state, 'finished'),
        ),
      )
      .limit(1);

    if (!template) {
      throw new Error('no finished replay to copy');
    }

    const id = randomUUID();

    await db.insert(schema.replay).values({
      ...template,
      id,
      candidateId,
      setId: setId ?? template.setId,
      searchId: null,
      startedAt,
      version: 0,
    });

    return id;
  };

  it('names the candidate a recorded change came from, its newest replay, and keeps naming it once the candidate is withdrawn', async () => {
    const candidate = await proposedCandidate(
      'Drain in strict order',
      'Build it, strictly in order.',
    );
    const replayedAt = new Date();

    await replayOfCandidate(
      candidate.id,
      new Date(replayedAt.getTime() - 60_000),
    );
    const tied = [
      await replayOfCandidate(candidate.id, replayedAt),
      await replayOfCandidate(candidate.id, replayedAt),
    ].sort();

    expect(await askedAbout([{ runId: randomUUID() }])).toEqual([]);

    const changed = await ranWith(candidate.fingerprint);
    const changedAt = changed.at;
    const expected: Origin = {
      stationId: BUILD,
      runId: changed.runId,
      fingerprint: candidate.fingerprint,
      changedAt: changedAt.toISOString(),
      candidateId: candidate.id,
      name: 'Drain in strict order',
      kind: 'proposed',
      lineId: DELIVERY,
      searchId: null,
      replayId: tied[0] ?? null,
      createdAt: candidate.createdAt.toISOString(),
      withdrawn: false,
    };

    await eventually(
      async () => (await askedAbout([changed])).length === 1,
      WITHIN,
    );
    expect(await askedAbout([changed])).toEqual([expected]);

    const replayed = (await owner().get(replayedPath()).expect(200))
      .body as Replayed;
    const shownCandidates = replayed.stations
      .flatMap((each) => each.sets)
      .flatMap((each) => each.candidates);
    const shown = shownCandidates.find(
      (each) => each.candidateId === candidate.id,
    );
    const notAdopted = shownCandidates.filter(
      (each) => each.candidateId !== candidate.id,
    );

    expect(shown?.adoption).toEqual({
      at: changedAt.toISOString(),
      live: false,
      creditedTo: null,
    });
    expect(notAdopted.length).toBeGreaterThan(0);
    expect(notAdopted.every((each) => each.adoption === null)).toBe(true);

    await http()
      .delete(`/api/resources/replay-candidates/${candidate.id}`)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('If-Match', `"${candidate.version}"`)
      .expect(204);
    const [gone] = await db
      .select()
      .from(schema.replayCandidate)
      .where(eq(schema.replayCandidate.id, candidate.id));

    expect(gone).toBeUndefined();
    expect(await askedAbout([changed])).toEqual([
      { ...expected, replayId: null, withdrawn: true },
    ]);
  }, 120_000);

  it('keeps crediting an adopted proposal once the set it was replayed in is deleted', async () => {
    const candidate = await proposedCandidate(
      'Drain past its set',
      'Build it, past its set.',
    );
    const setId = await openSet('Set to delete', fiveTasks.slice(0, 1));
    const replayId = await replayOfCandidate(candidate.id, new Date(), setId);
    const changed = await ranWith(candidate.fingerprint);

    await eventually(
      async () => (await askedAbout([changed])).length === 1,
      WITHIN,
    );
    expect(await askedAbout([changed])).toEqual([
      expect.objectContaining({
        candidateId: candidate.id,
        replayId,
        withdrawn: false,
      }),
    ]);

    await http()
      .delete(`${teamPath()}/replay-sets/${setId}`)
      .set(TEST_USER_HEADER, team.owner.value)
      .expect(204);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      const left = await db
        .select({ id: schema.replay.id })
        .from(schema.replay)
        .where(eq(schema.replay.setId, setId));

      return left.length === 0;
    }, WITHIN);

    expect(await askedAbout([changed])).toEqual([
      expect.objectContaining({
        candidateId: candidate.id,
        replayId: null,
        withdrawn: false,
      }),
    ]);
  }, 120_000);

  it('credits no candidate of another workspace or team, and answers another team nothing of this one', async () => {
    const candidate = await proposedCandidate(
      'Drain twice',
      'Build it, draining twice.',
    );
    const others = await openTeam(
      db,
      app.get(DrizzleTaskRepository),
      `replay-origins-${randomUUID().slice(0, 8)}`,
    );
    const hidden = await elsewhere(candidate, {
      workspaceId: others.workspaceId.value,
    });
    const otherTeams = await elsewhere(candidate, {
      teamId: others.teamId.value,
    });

    const hiddenRan = await ranWith(hidden);
    const otherTeamsRan = await ranWith(otherTeams);
    const own = await ranWith(candidate.fingerprint);

    await eventually(
      async () => (await askedAbout([own])).length === 1,
      WITHIN,
    );
    expect(await askedAbout([hiddenRan, otherTeamsRan])).toEqual([]);

    const answered = await http()
      .post(`/api/teams/${others.teamId.value}/config-origins`)
      .set(TEST_USER_HEADER, others.owner.value)
      .send({
        changes: [{ stationId: BUILD, runId: own.runId }],
      })
      .expect(200);

    expect(answered.body).toEqual({ origins: [] });
  }, 120_000);

  it('credits a withdrawn candidate made before the station took up its config, and nothing for a run that kept the config, though a candidate was made before it', async () => {
    const probe = await proposedCandidate(
      'Drain gently, first draft',
      'Build it, gently.',
    );

    await http()
      .delete(`/api/resources/replay-candidates/${probe.id}`)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('If-Match', `"${probe.version}"`)
      .expect(204);
    const first = await ranWith(probe.fingerprint);
    const candidate = await proposedCandidate(
      'Drain gently',
      'Build it, gently.',
    );
    const kept = await ranWith(candidate.fingerprint);

    expect(candidate.fingerprint).toBe(probe.fingerprint);
    expect(
      (await askedAbout([first, kept])).map((each) => [
        each.runId,
        each.candidateId,
        each.changedAt,
        each.withdrawn,
      ]),
    ).toEqual([[first.runId, probe.id, first.at.toISOString(), true]]);
  }, 120_000);

  it('credits no candidate made after the station took up its config by hand', async () => {
    const fingerprint = randomUUID().replaceAll('-', '').repeat(2);
    const edited = await ranWith(fingerprint);
    const candidate = await proposedCandidate(
      'Drain by hand',
      'Build it, by hand.',
    );
    await db
      .update(schema.replayCandidate)
      .set({ fingerprint })
      .where(eq(schema.replayCandidate.id, candidate.id));

    expect(await askedAbout([edited])).toEqual([]);
  }, 120_000);

  it('forgets a change once its task’s runs are deleted', async () => {
    const candidate = await proposedCandidate(
      'Drain once',
      'Build it, just once.',
    );
    const started = await startedWith(candidate.fingerprint);
    await heardEnded(started);

    expect(
      (await askedAbout([started])).map((each) => each.candidateId),
    ).toEqual([candidate.id]);

    const deleted: TaskDeletedIntegrationEvent = {
      kind: TASK_DELETED,
      taskId: started.taskId,
      workspaceId: team.workspaceId.value,
    };
    await app.get(EventOutbox).record([deleted]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);

      return (
        (
          await db
            .select()
            .from(schema.runRecord)
            .where(eq(schema.runRecord.runId, started.runId))
        ).length === 0
      );
    }, WITHIN);

    expect(await askedAbout([started])).toEqual([]);
  }, 120_000);

  it('credits a stretch to the newest candidate made by its start, not one made after it with the same config, and takes adoption from that start', async () => {
    const base = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const shifted = (seconds: number) =>
      new Date(base.getTime() + seconds * 1000);
    const prompt = 'Build it, settling two days ago.';
    const before = await proposedCandidate('Settle before', prompt);
    const after = await proposedCandidate('Settle after', prompt);
    const fingerprint = before.fingerprint;
    const other = randomUUID().replaceAll('-', '').repeat(2);

    expect(after.fingerprint).toBe(fingerprint);
    await madeAt(before.id, shifted(-30));
    await madeAt(after.id, shifted(30));
    await replayOfCandidate(before.id, new Date());
    await replayOfCandidate(after.id, new Date());

    await ranWith(other, shifted(-60));
    const kept = await ranWith(fingerprint, shifted(60));
    const changed = await ranWith(fingerprint, shifted(0));

    expect(
      (await askedAbout([changed, kept])).map((each) => [
        each.runId,
        each.candidateId,
        each.changedAt,
      ]),
    ).toEqual([[changed.runId, before.id, shifted(0).toISOString()]]);

    const shown = await adoptionsShown();

    expect(shown.get(before.id)).toEqual({
      at: shifted(0).toISOString(),
      live: false,
      creditedTo: null,
    });
    expect(shown.get(after.id)).toBeNull();
  }, 120_000);

  it('says an adopted candidate is live while its station runs its config, and not once the station changes', async () => {
    const prompt = 'Build it, live.';
    const candidate = await proposedCandidate('Run it live', prompt);

    await replayOfCandidate(candidate.id, new Date());
    const changedAt = (await ranWith(candidate.fingerprint)).at;
    const adoption = async () => (await adoptionsShown()).get(candidate.id);
    const liveFingerprint = async () =>
      (
        await app
          .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
          .live(DELIVERY, BUILD)
      )?.fingerprint;

    await eventually(async () => Boolean(await adoption()), WITHIN);
    expect(await adoption()).toEqual({
      at: changedAt.toISOString(),
      live: false,
      creditedTo: null,
    });

    await withLivePrompt(prompt, async () => {
      expect(await liveFingerprint()).toBe(candidate.fingerprint);
      expect(await adoption()).toEqual({
        at: changedAt.toISOString(),
        live: true,
        creditedTo: null,
      });
    });

    expect(await liveFingerprint()).not.toBe(candidate.fingerprint);
    expect(await adoption()).toEqual({
      at: changedAt.toISOString(),
      live: false,
      creditedTo: null,
    });
  }, 120_000);

  it('says only the candidate credited with the station’s latest change is live, though an earlier one made the same config', async () => {
    const prompt = 'Build it, live twice.';
    const earlier = await proposedCandidate('Live first', prompt);

    await replayOfCandidate(earlier.id, new Date());
    const first = await ranWith(earlier.fingerprint);
    await ranWith(randomUUID().replaceAll('-', '').repeat(2));
    const later = await proposedCandidate('Live again', prompt);
    await replayOfCandidate(later.id, new Date());
    const again = await ranWith(later.fingerprint);

    expect(later.fingerprint).toBe(earlier.fingerprint);
    expect(
      (await askedAbout([first, again])).map((each) => [
        each.runId,
        each.candidateId,
      ]),
    ).toEqual([
      [first.runId, earlier.id],
      [again.runId, later.id],
    ]);
    await withLivePrompt(prompt, async () => {
      const shown = await adoptionsShown();

      expect(shown.get(earlier.id)).toEqual({
        at: first.at.toISOString(),
        live: false,
        creditedTo: {
          candidateId: later.id,
          name: 'Live again',
          withdrawn: false,
        },
      });
      expect(shown.get(later.id)).toEqual({
        at: again.at.toISOString(),
        live: true,
        creditedTo: null,
      });
    });

    await http()
      .delete(`/api/resources/replay-candidates/${later.id}`)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('If-Match', `"${later.version}"`)
      .expect(204);

    expect((await adoptionsShown()).get(earlier.id)).toEqual({
      at: first.at.toISOString(),
      live: false,
      creditedTo: {
        candidateId: later.id,
        name: 'Live again',
        withdrawn: true,
      },
    });
  }, 120_000);

  it('resolves each config change the team’s insights mark to the candidate it came from, reverts among them, past a change the lookback cut off', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const longAgo = new Date(Date.now() - 60 * DAY);
    const returned = await proposedCandidate(
      'Return after the lookback',
      'Build it, as long ago.',
    );
    const changed = await proposedCandidate(
      'Change in the week',
      'Build it, this week.',
    );
    const manual = randomUUID().replaceAll('-', '').repeat(2);

    await madeAt(returned.id, new Date(longAgo.getTime() - DAY));
    await ranWith(returned.fingerprint, longAgo);
    const away = await ranWith(manual);
    const back = await ranWith(returned.fingerprint);
    const toChanged = await ranWith(changed.fingerprint);
    const reverted = await ranWith(manual);
    const revertedBack = await ranWith(returned.fingerprint);

    interface Marker {
      stationId: string;
      fingerprint: string;
      previousFingerprint: string;
      firstRunAt: string;
      runId: string;
    }

    const markers = (
      (
        await owner()
          .get(`${teamPath()}/insights/changes?period=7d`)
          .expect(200)
      ).body as { markers: Marker[] }
    ).markers;
    const origins = new Map<string, Origin>();

    for (let at = 0; at < markers.length; at += 100) {
      const answered = (
        await owner()
          .post(originsPath(), {
            changes: markers.slice(at, at + 100).map((each) => ({
              stationId: each.stationId,
              runId: each.runId,
            })),
          })
          .expect(200)
      ).body.origins as Origin[];

      for (const each of answered) {
        origins.set(`${each.stationId} ${each.runId}`, each);
      }
    }

    const originOf = (ran: Ran) => origins.get(`${BUILD} ${ran.runId}`);
    const marked = new Set(markers.map((each) => each.runId));

    expect(
      [away, back, toChanged, reverted, revertedBack].every((each) =>
        marked.has(each.runId),
      ),
    ).toBe(true);
    expect(originOf(away)).toBeUndefined();
    expect(originOf(back)?.candidateId).toBe(returned.id);
    expect(originOf(toChanged)?.candidateId).toBe(changed.id);
    expect(originOf(reverted)).toBeUndefined();
    expect(originOf(revertedBack)?.candidateId).toBe(returned.id);
    const markerOf = (ran: Ran) =>
      markers.find((each) => each.runId === ran.runId);

    expect(markerOf(reverted)?.previousFingerprint).toBe(changed.fingerprint);
    expect(markerOf(revertedBack)?.previousFingerprint).toBe(manual);
    expect(origins.size).toBeGreaterThan(0);
    for (const marker of markers) {
      const origin = origins.get(`${marker.stationId} ${marker.runId}`);

      if (origin) {
        expect([origin.fingerprint, origin.changedAt]).toEqual([
          marker.fingerprint,
          marker.firstRunAt,
        ]);
      }
    }
  }, 120_000);

  it('marks every config change that starts a stretch in the week, from the station’s first run in it on, passing over a provisioning failure between two runs of one config', async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const before = randomUUID().replaceAll('-', '').repeat(2);
    const after = randomUUID().replaceAll('-', '').repeat(2);
    const unprovisioned = randomUUID().replaceAll('-', '').repeat(2);

    await ranWith(before, new Date(Date.now() - 60 * DAY), POLISH);
    const first = await ranWith(after, undefined, POLISH);
    const failed = await failedToStart(unprovisioned, POLISH);
    const carriedOn = await ranWith(after, undefined, POLISH);

    const changes = (
      await owner().get(`${teamPath()}/insights/changes?period=7d`).expect(200)
    ).body as {
      period: { from: string; to: string };
      markers: {
        stationId: string;
        runId: string;
        fingerprint: string;
        previousFingerprint: string;
        firstRunAt: string;
        before: { runs: number };
        verdicts: { verdict: string }[];
      }[];
    };
    const overview = (
      await owner().get(`${teamPath()}/insights/overview?period=7d`).expect(200)
    ).body as { configChanges: { stationId: string; runId: string }[] };
    const from = new Date(changes.period.from);
    const to = new Date(changes.period.to);
    const stretches = app.get<ConfigStretchesPort>(CONFIG_STRETCHES);
    const everStarted = await stretches.stretchStarts(team.teamId.value, [
      { stationId: BUILD, from: new Date(0) },
      { stationId: POLISH, from: new Date(0) },
    ]);
    const firstEver = new Set(
      [BUILD, POLISH].flatMap((stationId) => {
        const [start] = everStarted.filter(
          (each) => each.stationId === stationId,
        );
        return start ? [start.runId] : [];
      }),
    );
    const inWeek = (
      await stretches.stretchStarts(team.teamId.value, [
        { stationId: BUILD, from },
        { stationId: POLISH, from },
      ])
    ).filter(
      (each) =>
        each.changedAt.getTime() < to.getTime() && !firstEver.has(each.runId),
    );
    const keyOf = (each: { stationId: string; runId: string }) =>
      `${each.stationId} ${each.runId}`;
    const atStations = (each: { stationId: string }) =>
      each.stationId === BUILD || each.stationId === POLISH;

    expect(inWeek.map(keyOf).sort()).toEqual(
      changes.markers.filter(atStations).map(keyOf).sort(),
    );
    expect(inWeek.map(keyOf).sort()).toEqual(
      overview.configChanges.filter(atStations).map(keyOf).sort(),
    );

    const edge = changes.markers.find((each) => each.runId === first.runId);

    expect(edge).toMatchObject({
      stationId: POLISH,
      fingerprint: after,
      previousFingerprint: before,
      before: { runs: 0 },
    });
    expect(
      edge?.verdicts.every((each) => each.verdict === 'insufficient'),
    ).toBe(true);
    expect(
      changes.markers.some(
        (each) => each.runId === failed.runId || each.runId === carriedOn.runId,
      ),
    ).toBe(false);
  }, 120_000);

  const withdrawnAt = async (
    others: Awaited<ReturnType<typeof openTeam>>,
    stationId: string,
  ) => {
    const id = randomUUID();

    await db.insert(schema.withdrawnOriginCandidate).values({
      id,
      workspaceId: others.workspaceId.value,
      teamId: others.teamId.value,
      lineId: others.line.id.value,
      stationId,
      fingerprint: 'c'.repeat(64),
      name: `Withdrawn ${id.slice(0, 6)}`,
      createdAt: new Date(),
    });

    return id;
  };

  const withdrawnOf = async (teamId: string) =>
    (
      await db
        .select({ stationId: schema.withdrawnOriginCandidate.stationId })
        .from(schema.withdrawnOriginCandidate)
        .where(eq(schema.withdrawnOriginCandidate.teamId, teamId))
    ).map((each) => each.stationId);

  it('forgets the withdrawn origins of a disbanded team', async () => {
    const others = await openTeam(
      db,
      app.get(DrizzleTaskRepository),
      `replay-disbanded-${randomUUID().slice(0, 8)}`,
    );

    await withdrawnAt(others, others.stationId.value);
    expect(await withdrawnOf(others.teamId.value)).toEqual([
      others.stationId.value,
    ]);

    await db.delete(schema.team).where(eq(schema.team.id, others.teamId.value));
    const disbanded: TeamDisbandedIntegrationEvent = {
      kind: TEAM_DISBANDED,
      workspaceId: others.workspaceId.value,
      teamId: others.teamId.value,
      key: 'others',
    };
    await app.get(EventOutbox).record([disbanded]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);

      return (await withdrawnOf(others.teamId.value)).length === 0;
    }, WITHIN);

    expect(await withdrawnOf(others.teamId.value)).toEqual([]);
  }, 120_000);

  it('forgets the withdrawn origins at a station its line no longer has, and keeps those at the stations it still has', async () => {
    const others = await openTeam(
      db,
      app.get(DrizzleTaskRepository),
      `replay-gone-${randomUUID().slice(0, 8)}`,
    );
    const lineId = others.line.id.value;
    const gone = randomUUID();

    await db
      .update(schema.station)
      .set({ position: 2 })
      .where(
        and(eq(schema.station.lineId, lineId), eq(schema.station.position, 1)),
      );
    await db.insert(schema.station).values({
      id: gone,
      lineId,
      key: 'inspect',
      name: 'Inspect',
      position: 1,
      kind: 'work',
      harness: 'claude-code',
      agentPrompt: 'Inspect it.',
    });
    await withdrawnAt(others, others.stationId.value);
    await withdrawnAt(others, gone);
    expect((await withdrawnOf(others.teamId.value)).sort()).toEqual(
      [others.stationId.value, gone].sort(),
    );

    await db.delete(schema.station).where(eq(schema.station.id, gone));
    await db
      .update(schema.station)
      .set({ position: 1 })
      .where(
        and(eq(schema.station.lineId, lineId), eq(schema.station.position, 2)),
      );
    const redefined: LineRedefinedIntegrationEvent = {
      kind: LINE_REDEFINED,
      lineId,
      workspaceId: others.workspaceId.value,
      teamId: others.teamId.value,
      stationIds: [others.stationId.value, gone],
    };
    await app.get(EventOutbox).record([redefined]);
    await app.get(EventDelivery).drain(2_000);

    expect(await withdrawnOf(others.teamId.value)).toEqual([
      others.stationId.value,
    ]);
  }, 120_000);

  it('refuses more than 100 changes at once, before reading any', async () => {
    const refused = await owner()
      .post(originsPath(), {
        changes: Array.from({ length: 101 }, (_, at) => ({
          stationId: randomUUID(),
          runId: `run_${at}`,
        })),
      })
      .expect(422);

    expect(refused.body.detail).toBe('101 changes. At most 100 at once.');
  });

  it('counts changes from one when it refuses one', async () => {
    const refused = await owner()
      .post(originsPath(), {
        changes: [
          { stationId: BUILD, runId: randomUUID() },
          { stationId: 7, runId: randomUUID() },
        ],
      })
      .expect(422);
    const blank = await owner()
      .post(originsPath(), {
        changes: [{ stationId: BUILD, runId: ' ' }],
      })
      .expect(422);

    expect(refused.body.detail).toBe('Change 2: stationId must be text.');
    expect(blank.body.detail).toBe('Change 1: runId is blank.');
  });
});
