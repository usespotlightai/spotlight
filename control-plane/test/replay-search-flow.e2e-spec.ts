import { createHash, randomUUID } from 'node:crypto';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import {
  PULL_REQUESTS,
  type PullRequestOpening,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryCommit,
  type RepositoryContentsPort,
} from '@github/application/ports/repository-contents.port';
import type { INestApplication } from '@nestjs/common';
import { JUDGE, type JudgePort } from '@outcomes/application/ports/judge.port';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { TEAM_DISBANDED } from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
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
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { openDatabase, type TestDatabase } from './support/database';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-search-flow-${randomUUID().slice(0, 8)}`;
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

const CONFIG = 'acme/platform';
const CONFIG_FILE = 'teams/core/delivery.tf';
const PROMPT_FILE = 'teams/core/prompts/build.md';

const CONFIG_LINE = `resource "spotlight_line" "core_delivery" {
  key  = "delivery"
  name = "Delivery"

  station {
    key       = "build"
    name      = "Build"
    kind      = "work"
    harness   = "claude-code"
    prompt    = file("\${path.module}/prompts/build.md")
    passes_to = ["ship"]

    judge {
      rubric = ${JSON.stringify(RUBRIC)}
      sample = 0.1
      trust  = 0.6
    }
  }
}
`;

const github = {
  files: new Map<string, string>(),
  commits: [] as RepositoryCommit[],
  opened: [] as PullRequestOpening[],
};

const repositoryContents: RepositoryContentsPort = {
  fileAt: async (_workspace, repository, path) => {
    if (repository.value !== CONFIG) {
      throw new RepositoryUnreachableError(repository.value);
    }

    const content = github.files.get(path);

    return content === undefined
      ? null
      : {
          content,
          blobSha: 'blob_1',
          commit: 'commit_1',
          defaultBranch: 'main',
        };
  },
  committed: async (_workspace, _repository, commit) => {
    github.commits.push(commit);
    return `commit_${github.commits.length + 1}`;
  },
};

const pullRequests: PullRequestPort = {
  open: async (opening) => {
    const at = github.opened.findIndex(
      (each) => each.branch === opening.branch,
    );

    if (at < 0) {
      github.opened.push(opening);
    }

    return {
      url: `https://github.com/${CONFIG}/pull/${at < 0 ? github.opened.length : at + 1}`,
    };
  },
  changedOn: async () => [],
  changedIn: async () => [],
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
  put: (path: string, body: object, version: number) =>
    http()
      .put(path)
      .set(TEST_USER_HEADER, team.owner.value)
      .set('If-Match', `"${version}"`)
      .send(body),
  delete: (path: string) =>
    http().delete(path).set(TEST_USER_HEADER, team.owner.value),
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
  iterations: {
    number: number;
    kind: 'propose' | 'reflect';
    runId: string;
    state: string;
    reflection: {
      tasks: { taskId: string; originalRunId: string; replayRunId: string }[];
      causes: {
        taskId: string;
        cause: string;
        replayRunId: string;
      }[];
      outcome: string | null;
      endedSearch: boolean;
    } | null;
  }[];
  seed: { candidateId: string; heldOutScore: number | null };
  candidates: {
    candidateId: string;
    name: string;
    replayId: string;
    heldOutReplayId: string | null;
    searchScore: number | null;
    heldOutScore: number | null;
    onFrontier: boolean;
    onlyOnSeenTasks: 'marked' | 'too-few-held-out' | null;
  }[];
  frontier: string[];
  onlyOnSeenTasks: number;
  best: {
    name: string;
    onlyOnSeenTasks: 'marked' | 'too-few-held-out' | null;
  } | null;
}

type InboxEntry =
  | { kind: 'task'; id: string }
  | {
      kind: 'notice';
      id: string;
      teamId: string;
      form: string;
      headline: string;
      points: string[];
      link: string;
      linkLabel: string;
      unread: boolean;
      resolved: boolean;
    };

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

const originalsOf = async (replayId: string) =>
  (
    await db
      .select({ original: schema.replayEntry.originalRunId })
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, replayId))
  )
    .map((each) => each.original)
    .sort();

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

const auditOf = (searchId: string) =>
  db
    .select()
    .from(schema.configurationChange)
    .where(eq(schema.configurationChange.resourceId, searchId))
    .orderBy(schema.configurationChange.seq);

const delivered = async (event: DomainEvent): Promise<void> => {
  for (const each of app.get(EventSubscribers).listeningTo(event.kind)) {
    for (const raised of await each.handle(event)) {
      await delivered(raised);
    }
  }
};

const tokenWith = async (scopes: readonly string[]): Promise<string> => {
  const issued = await http()
    .post(`/api/resources/workspaces/${team.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({
      name: `searches-${scopes.join('-')}-${randomUUID().slice(0, 8)}`,
      scopes,
    });

  expect(issued.status).toBe(201);

  return issued.headers['spotlight-workspace-token'] as string;
};

const shared = process.env.DATABASE_URL;

let tenTasks: Original[];
let fiveTasks: Original[];

beforeAll(async () => {
  own = await openDatabase('replay_search_flow');
  process.env.DATABASE_URL = own.url;
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore)
      .overrideProvider(JUDGE)
      .useValue(judge)
      .overrideProvider(REPOSITORY_CONTENTS)
      .useValue(repositoryContents)
      .overrideProvider(PULL_REQUESTS)
      .useValue(pullRequests),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `search-flow-${randomUUID().slice(0, 8)}`,
  );

  await db.insert(schema.line).values({
    id: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: 'delivery',
    name: 'Delivery',
    source: { repository: CONFIG, path: CONFIG_FILE },
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

  tenTasks = [];
  for (let each = 0; each < 10; each += 1) {
    tenTasks.push(await anOriginal());
  }
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

describe('a search for a better station config', () => {
  it('estimates what it would start, spend and take, as its budget allots it, writing nothing', async () => {
    const setId = await openSet('Estimated', tenTasks);
    const budget = { iterations: 2, perIteration: 2, ceiling: 40 };

    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
        })
        .expect(200)
    ).body as {
      searchedTasks: number;
      heldOutTasks: number;
      runs: Record<string, number>;
      perReplayAllotments: Record<string, { amount: number }>;
      estimatedDuration: number | null;
      minGain: number;
      objective: string;
      warnings: { kind: string }[];
    };
    const split = HeldOutSplit.drawn({
      searchId: SearchId.of('estimate'),
      entries: tenTasks.map((each) =>
        ReplaySetEntry.of({
          runId: RunId.of(each.runId),
          taskId: TaskId.of(each.taskId),
          addedAt: new Date(),
        }),
      ),
      digest: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
    });
    const expected = estimateOf(
      SearchBudget.of({
        iterations: 2,
        perIteration: 2,
        ceiling: Spend.ceiling(40, 'USD'),
        concurrency: 10,
      }),
      split,
      [],
    );

    expect(estimate.searchedTasks).toBe(7);
    expect(estimate.heldOutTasks).toBe(3);
    expect(estimate.runs).toEqual(expected.runs);
    expect(estimate.perReplayAllotments.seed?.amount).toBeCloseTo(
      expected.allotment.seed.amount,
      6,
    );
    expect(estimate.perReplayAllotments.searchReplay?.amount).toBeCloseTo(
      expected.allotment.searchReplay.amount,
      6,
    );
    expect(estimate.perReplayAllotments.heldOutReplay?.amount).toBeCloseTo(
      expected.allotment.heldOutReplay.amount,
      6,
    );
    expect(estimate.estimatedDuration).toBeNull();
    expect(estimate.minGain).toBe(0.05);
    expect(estimate.objective).toBe('success');
    expect(estimate.warnings).toEqual([{ kind: 'noise-unmeasured' }]);
    expect(await db.select().from(schema.replaySearch)).toEqual([]);

    const repeated = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: { ...budgetOf(budget), repeats: 2 },
        })
        .expect(200)
    ).body as { runs: Record<string, number> };

    expect(repeated.runs).toEqual({
      seed: expected.runs.seed * 2,
      searchReplays: expected.runs.searchReplays * 2,
      heldOutReplays: expected.runs.heldOutReplays * 2,
      agent: expected.runs.agent,
      total: expected.runs.total * 2 - expected.runs.agent,
    });

    await owner()
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf({ ...budget, iterations: 11 }),
      })
      .expect(422)
      .expect((answer) =>
        expect(answer.body.errors).toEqual([
          expect.objectContaining({
            path: 'budget.iterations',
            severity: 'error',
          }),
        ]),
      );

    const reader = await tokenWith(['read']);
    const stranger = randomUUID();

    await db.insert(schema.user).values({
      id: stranger,
      name: 'Eve',
      email: `${stranger}@example.com`,
    });
    await bearing(reader).get(`${stationPath()}/searches`).expect(200);
    await bearing(reader).get(`${teamPath()}/searches`).expect(200);
    await bearing(reader)
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf(budget),
      })
      .expect(200);
    await bearing(reader)
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'claude-code' },
        budget: budgetOf(budget),
      })
      .expect(403);
    await http()
      .get(`${teamPath()}/searches`)
      .set(TEST_USER_HEADER, stranger)
      .expect(404);
    await owner()
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'no-such-harness' },
        budget: budgetOf(budget),
      })
      .expect(422)
      .expect((answer) =>
        expect(
          answer.body.errors.map((each: { path: string }) => each.path),
        ).toEqual(['agent.harness']),
      );
    expect(await db.select().from(schema.replaySearch)).toEqual([]);
  }, 120_000);

  it('replays the live config first, then runs its agent, takes its candidates only on the searched tasks, shows it no held-out task, holds out its frontier, and finishes', async () => {
    const setId = await openSet('Searched', tenTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 2,
      perIteration: 2,
      ceiling: 60,
    });

    const started = await searchOf(id);

    expect(started.state).toBe('seeding');
    expect(started.split.heldOut).toHaveLength(3);
    expect((await replayRow(seedReplayId))?.searchId).toBe(id);
    expect((await replayRow(seedReplayId))?.baseline).toBe(true);
    expect(await searchRunsOf(id)).toEqual([]);

    const extra = await anOriginal();
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: extra.runId,
      })
      .expect(409);
    await owner()
      .delete(
        `${teamPath()}/replay-sets/${setId}/entries/${tenTasks[0]?.runId}`,
      )
      .expect(409);
    await owner().delete(`${teamPath()}/replay-sets/${setId}`).expect(409);
    await owner()
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'claude-code' },
        budget: budgetOf({ iterations: 1, perIteration: 1, ceiling: 10 }),
      })
      .expect(409);

    await drained(() => ({ score: 4, cost: 0.2 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await heldSearchRun(id, 1);
    const held = new Set(started.split.heldOut.map((each) => each.taskId));
    const heldRuns = started.split.heldOut.map((each) => each.runId).sort();
    const searchedRuns = started.split.searched
      .map((each) => each.runId)
      .sort();

    const history = (
      await bearing(agent.token)
        .get(`/api/runs/${agent.runId}/history?station=build`)
        .expect(200)
    ).body as {
      runs: { taskId: string; runId: string }[];
      candidates: {
        candidateName: string;
        runs: { original: string; taskId: string; succeeded: boolean | null }[];
      }[];
      seedBlock: { key: string };
    };

    expect(history.seedBlock.key).toBe('build');
    expect(history.runs.some((each) => held.has(each.taskId))).toBe(false);
    expect(history.candidates.map((each) => each.candidateName)).toEqual([
      'seed',
    ]);
    expect(
      history.candidates[0]?.runs.map((each) => each.original).sort(),
    ).toEqual(searchedRuns);
    expect(
      history.candidates[0]?.runs.every((each) => each.succeeded === true),
    ).toBe(true);

    const block = await liveBlock();
    const refused = await proposing(agent, {
      name: 'Not a slug',
      hypothesis: '',
      station: { ...block, passesTo: [] },
    }).expect(422);

    expect(refused.body.errors).toEqual(
      expect.arrayContaining([
        { path: 'name', message: expect.any(String), severity: 'error' },
        { path: 'hypothesis', message: expect.any(String), severity: 'error' },
        {
          path: 'station.passesTo',
          message: expect.any(String),
          severity: 'error',
        },
      ]),
    );

    const strong = (
      await proposing(agent, {
        name: 'in-order',
        hypothesis: 'Draining in order stops the stall.',
        station: { ...block, prompt: 'Build it, draining in order.' },
      }).expect(201)
    ).body as { candidateId: string; name: string; replayId: string };
    const again = await proposing(agent, {
      name: 'in-order',
      hypothesis: 'Said twice.',
      station: { ...block, prompt: 'Build it, draining in order.' },
    }).expect(201);
    const terse = {
      name: 'terse',
      hypothesis: 'Less to read is less to get wrong.',
      station: { ...block, prompt: 'Build.' },
    };
    const [one, other] = await Promise.all([
      proposing(agent, terse),
      proposing(agent, terse),
    ]);

    expect([one.status, other.status]).toEqual([201, 201]);
    expect(one.body).toEqual(other.body);

    const weak = one.body as { candidateId: string; replayId: string };

    expect(
      (
        await db
          .select()
          .from(schema.replayCandidate)
          .where(eq(schema.replayCandidate.searchId, id))
      ).map((each) => each.name),
    ).toEqual(expect.arrayContaining(['in-order', 'terse']));
    expect(
      await db
        .select()
        .from(schema.replayCandidate)
        .where(eq(schema.replayCandidate.searchId, id)),
    ).toHaveLength(2);

    await app.get(DispatchReplayRuns).workDue();
    const bystander = await claimed();

    if (!bystander) {
      throw new Error('no replay run waited to be claimed');
    }

    const byStander = await bearing(bystander.token)
      .post(`/api/runs/${agent.runId}/search-candidates`, {
        name: 'stranger',
        hypothesis: 'Not my run.',
        station: { ...block, prompt: 'Build it, stranger.' },
      })
      .expect(404);

    expect(byStander.body.detail).toBe('The search no longer holds this run');
    await finished(
      bystander,
      ((await entryOf(bystander.runId))?.replayId ?? '') === strong.replayId
        ? 5
        : 2,
      0.1,
    );

    expect(again.body).toEqual(strong);
    await proposing(agent, {
      name: 'third',
      hypothesis: 'One too many.',
      station: { ...block, prompt: 'Build it twice.' },
    }).expect(409);
    expect(await originalsOf(strong.replayId)).toEqual(searchedRuns);
    expect(await originalsOf(weak.replayId)).toEqual(searchedRuns);

    await endedSearchRun(agent);
    await proposing(agent, {
      name: 'late',
      hypothesis: 'Too late.',
      station: block,
    }).expect(404);

    await eventually(async () => {
      const read = await owner().get(
        `${teamPath()}/search-runs/${agent.runId}`,
      );

      return read.status === 200 && read.body.spent.spentCosts.length > 0;
    }, WITHIN);

    const searchRun = (
      await owner().get(`${teamPath()}/search-runs/${agent.runId}`).expect(200)
    ).body as {
      searchId: string;
      iteration: number;
      state: string;
      agent: { harness: string; model: string | null; effort: string | null };
      spent: {
        spentCosts: { amount: number; currency: string }[];
        unpricedCalls: number;
      };
      journals: unknown[];
      briefing: string;
    };
    const [dispatched] = await db
      .select({ spec: schema.run.spec })
      .from(schema.run)
      .where(eq(schema.run.id, agent.runId));

    expect(searchRun.briefing).toBe(
      (dispatched?.spec as { briefing: string } | undefined)?.briefing,
    );
    expect(searchRun).toMatchObject({
      searchId: id,
      iteration: 1,
      state: 'completed',
      agent: { harness: 'claude-code', model: null, effort: 'high' },
      spent: {
        spentCosts: [{ amount: 0.05, currency: 'USD' }],
        unpricedCalls: 0,
      },
    });
    expect(searchRun.journals.length).toBeGreaterThan(0);
    await bearing(await tokenWith(['read']))
      .get(`${teamPath()}/search-runs/${agent.runId}`)
      .expect(200);
    await owner()
      .get(`${teamPath()}/search-runs/${tenTasks[0]?.runId}`)
      .expect(404);

    const seedRead = (
      await owner().get(`${teamPath()}/replays/${seedReplayId}`).expect(200)
    ).body as { search: { searchId: string; candidateName: string } | null };

    expect(seedRead.search).toEqual({ searchId: id, candidateName: 'seed' });

    await drained((replayId) =>
      replayId === strong.replayId
        ? { score: 5, cost: 0.1 }
        : { score: 2, cost: 0.1 },
    );
    expect(await replayEnded(strong.replayId)).toBe('finished');

    const [strongRun] = await db
      .select({ runId: schema.replayEntry.runId })
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, strong.replayId));
    const ofRun = (
      await owner()
        .get(`${teamPath()}/replay-runs/${strongRun?.runId}/replay`)
        .expect(200)
    ).body as { search: { searchId: string; candidateName: string } | null };

    expect(ofRun.search).toEqual({ searchId: id, candidateName: 'in-order' });
    expect(await replayEnded(weak.replayId)).toBe('finished');

    const second = await heldSearchRun(id, 2);
    const later = (
      await bearing(second.token)
        .get(`/api/runs/${second.runId}/history?station=build`)
        .expect(200)
    ).body as typeof history;

    expect(later.candidates.map((each) => each.candidateName)).toEqual([
      'seed',
      'in-order',
      'terse',
    ]);
    for (const candidate of later.candidates) {
      expect(candidate.runs.map((each) => each.original).sort()).toEqual(
        searchedRuns,
      );
      expect(candidate.runs.some((each) => held.has(each.taskId))).toBe(false);
    }
    expect(
      later.candidates[2]?.runs.every((each) => each.succeeded === false),
    ).toBe(true);
    expect(later.runs.some((each) => held.has(each.taskId))).toBe(false);

    await endedSearchRun(second);
    await eventually(async () => {
      await app.get(AdvanceSearches).workDue();
      return (await searchRow(id))?.heldOut.length === 1;
    }, WITHIN);

    const holding = await searchOf(id);
    const heldOutReplayId = holding.candidates.find(
      (each) => each.name === 'in-order',
    )?.heldOutReplayId as string;

    expect(holding.state).toBe('holding-out');
    expect(holding.ending).toBe('iterations-spent');
    expect(
      holding.candidates.find((each) => each.name === 'terse')?.heldOutReplayId,
    ).toBeNull();
    expect(await originalsOf(heldOutReplayId)).toEqual(heldRuns);

    await drained(() => ({ score: 5, cost: 0.1 }));
    await eventually(async () => {
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);

    const done = await searchOf(id);

    expect(done.ending).toBe('iterations-spent');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['in-order', true],
        ['terse', false],
      ],
    );
    expect(done.candidates[0]?.searchScore).toBe(1);
    expect(done.candidates[0]?.heldOutScore).toBe(1);
    expect(done.candidates[1]?.searchScore).toBe(0);
    expect(done.candidates.map((each) => each.onlyOnSeenTasks)).toEqual([
      null,
      null,
    ]);
    expect(done.onlyOnSeenTasks).toBe(0);
    expect(done.best?.onlyOnSeenTasks).toBeNull();
    expect(done.frontier).toContain(done.seed.candidateId);
    expect(done.best?.name).toBe('in-order');
    expect(done.spent.amount).toBeGreaterThan(0);

    const listed = (await owner().get(`${stationPath()}/searches`).expect(200))
      .body as { id: string; best: { name: string } | null }[];
    const ofTeam = (await owner().get(`${teamPath()}/searches`).expect(200))
      .body as { id: string; stationId: string; state: string }[];

    expect(listed.find((each) => each.id === id)?.best?.name).toBe('in-order');
    expect(ofTeam.find((each) => each.id === id)).toMatchObject({
      stationId: BUILD,
      state: 'finished',
    });
    expect(
      (await auditOf(id)).map((each) => [each.resource, each.action]),
    ).toEqual([['replay-search', 'created']]);

    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: extra.runId,
      })
      .expect(204);
  }, 120_000);

  it('ends when its seed spends past its ceiling, and when a person stops it', async () => {
    const setId = await openSet('Capped', fiveTasks);
    const capped = await startSearch(setId, {
      iterations: 1,
      perIteration: 1,
      ceiling: 1,
    });

    await drained(() => ({ score: 4, cost: 5 }));
    await eventually(
      async () => (await searchState(capped.id)) === 'finished',
      WITHIN,
    );

    expect((await searchRow(capped.id))?.ending).toBe('ceiling-reached');
    expect((await replayRow(capped.seedReplayId))?.state).toBe('over-budget');
    expect(await searchRunsOf(capped.id)).toEqual([]);

    const stopped = await startSearch(setId, {
      iterations: 3,
      perIteration: 1,
      ceiling: 20,
    });

    await owner().post(`${teamPath()}/searches/${stopped.id}/stop`).expect(204);
    await owner().post(`${teamPath()}/searches/${stopped.id}/stop`).expect(409);

    expect((await searchRow(stopped.id))?.ending).toBe('stopped');
    await eventually(
      async () => (await replayRow(stopped.seedReplayId))?.state === 'stopped',
      WITHIN,
    );
    expect(
      (await auditOf(stopped.id)).map((each) => [each.resource, each.action]),
    ).toEqual(
      expect.arrayContaining([
        ['replay-search', 'created'],
        ['replay-search', 'updated'],
      ]),
    );
  }, 120_000);

  it('looks into why once two iterations in a row came to nothing, takes a cause for each failing searched task and none for a held-out one, ends stalled and tells who started it', async () => {
    const setId = await openSet('Stalling', fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 4,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    await endedSearchRun(await heldSearchRun(id, 1), true);
    await endedSearchRun(await heldSearchRun(id, 2), true);

    const reflecting = await heldSearchRun(id, 3);
    const looking = await searchOf(id);
    const reflection = looking.iterations[2]?.reflection;
    const searchedTasks = looking.split.searched.map((each) => each.taskId);
    const heldOutTasks = looking.split.heldOut.map((each) => each.taskId);

    expect(looking.state).toBe('searching');
    expect(looking.iterations.map((each) => each.kind)).toEqual([
      'propose',
      'propose',
      'reflect',
    ]);
    expect(reflection?.tasks.map((each) => each.taskId).sort()).toEqual(
      [...searchedTasks].sort(),
    );
    expect(reflection?.endedSearch).toBe(false);

    const [first, second, third] = reflection?.tasks ?? [];
    const causing = (taskId: string, cause: string, suggestion?: string) =>
      bearing(reflecting.token).post(
        `/api/runs/${reflecting.runId}/search-causes`,
        {
          taskId,
          cause,
          evidence: `The replay of ${taskId} shows the ${cause} at fault.`,
          ...(suggestion ? { suggestion } : {}),
        },
      );

    const heldOut = await causing(heldOutTasks[0] as string, 'task').expect(
      404,
    );
    const unknown = await causing('task_unknown', 'task').expect(404);

    expect(heldOut.body.detail.replace(heldOutTasks[0], '<task>')).toBe(
      unknown.body.detail.replace('task_unknown', '<task>'),
    );
    await causing(first?.taskId as string, 'luck').expect(422);
    await proposing(reflecting, {
      name: 'late',
      hypothesis: 'Proposed while looking into why.',
      station: await liveBlock(),
    }).expect(409);

    await causing(first?.taskId as string, 'config').expect(201);
    expect(
      (
        await causing(
          first?.taskId as string,
          'judge',
          'Drop the line of the rubric that asks for tests.',
        ).expect(201)
      ).body,
    ).toEqual({
      taskId: first?.taskId,
      cause: 'judge',
      replayRunId: first?.replayRunId,
    });
    await causing(
      second?.taskId as string,
      'task',
      'Take it out of the set.',
    ).expect(201);
    await causing(third?.taskId as string, 'check').expect(201);

    await endedSearchRun(reflecting);
    await eventually(
      async () => (await searchState(id)) === 'finished',
      WITHIN,
    );

    const stalled = await searchOf(id);
    const looked = stalled.iterations[2]?.reflection;

    expect(stalled.ending).toBe('stalled');
    expect(stalled.iterations).toHaveLength(3);
    expect(looked?.endedSearch).toBe(true);
    expect(looked?.outcome).toBe('no-config-cause');
    expect(
      looked?.causes.map((each) => [each.taskId, each.cause, each.replayRunId]),
    ).toEqual([
      [first?.taskId, 'judge', first?.replayRunId],
      [second?.taskId, 'task', second?.replayRunId],
      [third?.taskId, 'check', third?.replayRunId],
    ]);
    expect(
      (await replayRow(seedReplayId))?.id === seedReplayId &&
        (await entryOf(first?.replayRunId as string))?.replayId,
    ).toBe(seedReplayId);

    const notice = await eventually(async () => {
      const inbox = (
        await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200)
      ).body as InboxEntry[];

      return (
        inbox.find(
          (each): each is Extract<InboxEntry, { kind: 'notice' }> =>
            each.kind === 'notice' && each.link.endsWith(`/${id}`),
        ) ?? null
      );
    }, WITHIN);

    expect(notice).toMatchObject({
      kind: 'notice',
      teamId: team.teamId.value,
      form: 'ended',
      headline:
        'The search for a better Build config stalled: nothing left the config can fix',
      link: `lines/${DELIVERY}/stations/${BUILD}/searches/${id}`,
      linkLabel: 'Open the search',
      unread: true,
      resolved: false,
    });
    expect(notice?.points).toEqual([
      expect.stringMatching(
        /^Two iterations in a row found nothing better, so its agent looked into the \d+ tasks? the best config so far still fails, and found none a change to the config could fix\./,
      ),
      expect.stringMatching(
        /^Fix the judge’s rubric, for “Drain (the )?queue[^”]*”: Drop the line of the rubric that asks for tests\.$/,
      ),
      expect.stringMatching(
        /^Take the task out of the replay set, or reword it, for “Drain (the )?queue[^”]*”: Take it out of the set\.$/,
      ),
      expect.stringMatching(
        /^Fix the station’s check, for “Drain (the )?queue[^”]*”: /,
      ),
    ]);
    expect(notice?.points.join('\n')).not.toContain(first?.taskId);

    await http()
      .post(`/api/workspaces/${team.slug}/inbox/notices/${notice?.id}/settle`)
      .set(TEST_USER_HEADER, randomUUID())
      .expect(404);
    await owner()
      .post(`/api/workspaces/elsewhere/inbox/notices/${notice?.id}/settle`)
      .expect(404);
    await owner()
      .post(`/api/workspaces/${team.slug}/inbox/notices/${notice?.id}/settle`)
      .expect(204);

    const settled = (
      (await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200))
        .body as InboxEntry[]
    ).find((each) => each.id === notice?.id);

    expect(settled).toMatchObject({ unread: false, resolved: true });

    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

    await db
      .update(schema.notice)
      .set({ raisedAt: longAgo, settledAt: longAgo })
      .where(eq(schema.notice.id, notice?.id as string));

    expect(
      (
        (await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200))
          .body as InboxEntry[]
      ).some((each) => each.id === notice?.id),
    ).toBe(false);
  }, 120_000);

  it('searches on once looking into why it stalled finds a cause the config can fix, telling no one', async () => {
    const setId = await openSet('Stalling again', fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 4,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    await endedSearchRun(await heldSearchRun(id, 1), true);
    await endedSearchRun(await heldSearchRun(id, 2), true);

    const reflecting = await heldSearchRun(id, 3);
    const [failing] =
      (await searchOf(id)).iterations[2]?.reflection?.tasks ?? [];

    await bearing(reflecting.token)
      .post(`/api/runs/${reflecting.runId}/search-causes`, {
        taskId: failing?.taskId,
        cause: 'config',
        evidence: 'It never ran the migrations the prompt leaves out.',
        suggestion: 'Tell it to run migrations first.',
      })
      .expect(201);
    await endedSearchRun(reflecting);

    const next = await heldSearchRun(id, 4);
    const goingOn = await searchOf(id);

    expect(goingOn.state).toBe('searching');
    expect(goingOn.iterations.map((each) => each.kind)).toEqual([
      'propose',
      'propose',
      'reflect',
      'propose',
    ]);
    expect(goingOn.iterations[2]?.reflection?.endedSearch).toBe(false);
    expect(goingOn.iterations[2]?.reflection?.outcome).toBe('went-on');
    const briefed = (await searchRunsOf(id)).find(
      (each) => each.id === next.runId,
    )?.spec as { briefing?: string } | undefined;

    expect(briefed?.briefing).toContain(
      'Suggested: Tell it to run migrations first.',
    );

    await endedSearchRun(next, true);
    await eventually(
      async () => (await searchState(id)) === 'finished',
      WITHIN,
    );

    expect((await searchRow(id))?.ending).toBe('iterations-spent');

    const inbox = (
      await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200)
    ).body as InboxEntry[];

    expect(
      inbox.some(
        (each) => each.kind === 'notice' && each.link.endsWith(`/${id}`),
      ),
    ).toBe(false);
  }, 120_000);

  it('looks for the same success at less cost on a set its live config saturates, ranking the cheapest candidate that succeeds as often first and leaving out a cheaper one that succeeds less', async () => {
    const setId = await openSet('Saturated', tenTasks);
    const live = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate: 'live',
          ceiling: { amount: 20, currency: 'USD' },
        })
        .expect(201)
    ).body as { id: string };

    await eventually(async () => {
      await drained(() => ({ score: 5, cost: 0.2 }));
      return (await replayRow(live.id))?.state === 'finished';
    }, WITHIN);
    expect(await replayEnded(live.id)).toBe('finished');

    const budget = { iterations: 2, perIteration: 3, ceiling: 60 };
    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
        })
        .expect(200)
    ).body as { objective: string; warnings: { kind: string }[] };
    const told = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
          objective: 'success',
        })
        .expect(200)
    ).body as { objective: string };

    expect(estimate.objective).toBe('cost');
    expect(estimate.warnings).toContainEqual({ kind: 'saturated', rate: 1 });
    expect(told.objective).toBe('success');
    await owner()
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf(budget),
        objective: 'speed',
      })
      .expect(422);

    const started = (
      await owner()
        .post(`${stationPath()}/searches`, {
          setId,
          agent: { harness: 'claude-code', model: null, effort: 'high' },
          budget: budgetOf(budget),
        })
        .expect(201)
    ).body as { id: string; seedReplayId: string; objective: string };

    expect(started.objective).toBe('cost');
    expect((await searchRow(started.id))?.objective).toBe('cost');

    await drained(() => ({ score: 5, cost: 0.2 }));
    expect(await replayEnded(started.seedReplayId)).toBe('finished');

    const agent = await heldSearchRun(started.id, 1);
    const block = await liveBlock();
    const proposed = async (name: string, prompt: string) =>
      (
        await proposing(agent, {
          name,
          hypothesis: `${name} keeps the queue drained for less.`,
          station: { ...block, prompt },
        }).expect(201)
      ).body as { replayId: string };
    const cheap = await proposed('cheap', 'Build it, briefly.');
    const dear = await proposed('dear', 'Build it, at length.');
    const careless = await proposed('careless', 'Build it, carelessly.');
    const plan = (replayId: string) =>
      replayId === cheap.replayId
        ? { score: 5, cost: 0.05 }
        : replayId === dear.replayId
          ? { score: 5, cost: 0.5 }
          : replayId === careless.replayId
            ? { score: 1, cost: 0.01 }
            : { score: 5, cost: 0.05 };

    await endedSearchRun(agent);
    await drained(plan);
    await endedSearchRun(await heldSearchRun(started.id, 2));
    await eventually(async () => {
      await app.get(AdvanceSearches).workDue();
      return (await searchRow(started.id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(plan);
    await eventually(async () => {
      await judged();
      return (await searchState(started.id)) === 'finished';
    }, WITHIN);

    const done = (await searchOf(started.id)) as SearchRead & {
      objective: string;
    };

    expect(done.objective).toBe('cost');
    expect(done.best?.name).toBe('cheap');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['cheap', true],
        ['dear', false],
        ['careless', false],
      ],
    );
    expect(
      done.candidates.map((each) => [each.name, each.heldOutReplayId !== null]),
    ).toEqual([
      ['cheap', true],
      ['dear', false],
      ['careless', false],
    ]);
    expect(done.frontier).toEqual([
      done.candidates[0]?.candidateId,
      done.seed.candidateId,
    ]);
  }, 120_000);

  it('opens one pull request in the line’s config repository for a picked candidate, records why one was refused, and tries again when picked again', async () => {
    const setId = await openSet('Picked', fiveTasks);
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
        station: { ...block, prompt: 'Build it, draining in order.\n' },
      }).expect(201)
    ).body as { candidateId: string; replayId: string };
    const pickPath = (candidateId: string) =>
      `${teamPath()}/searches/${id}/candidates/${candidateId}/pick`;

    await owner().post(pickPath(proposed.candidateId)).expect(409);

    await endedSearchRun(agent);
    await drained(() => ({ score: 5, cost: 0.1 }));
    expect(await replayEnded(proposed.replayId)).toBe('finished');

    const searched = await searchOf(id);
    const reader = await tokenWith(['read']);

    await owner().post(pickPath(searched.seed.candidateId)).expect(409);
    await bearing(reader).post(pickPath(proposed.candidateId)).expect(403);

    github.files.set(CONFIG_FILE, CONFIG_LINE);
    github.files.set(PROMPT_FILE, 'Build it, some other way.');

    const [one, other] = await Promise.all([
      owner().post(pickPath(proposed.candidateId)),
      owner().post(pickPath(proposed.candidateId)),
    ]);

    expect([one.status, other.status].sort()).toEqual([200, 201]);
    expect(one.body.id).toBe(other.body.id);
    expect(one.body).toMatchObject({
      repository: CONFIG,
      path: CONFIG_FILE,
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      attempts: 1,
    });

    const pullRequestPath = `${teamPath()}/config-pull-requests/${one.body.id}`;
    const settled = () =>
      eventually(async () => {
        await app.get(OpenConfigPullRequests).workDue();
        const read = (await owner().get(pullRequestPath).expect(200)).body as {
          state: string;
        };

        return read.state === 'opening' ? null : read;
      }, WITHIN);

    expect(await settled()).toMatchObject({
      state: 'refused',
      url: null,
      reason: { code: 'drifted', attribute: 'prompt' },
    });
    expect(github.commits).toEqual([]);

    github.files.set(PROMPT_FILE, 'Build it.');
    const retried = await owner()
      .post(pickPath(proposed.candidateId))
      .expect(201);

    expect(retried.body).toMatchObject({
      id: one.body.id,
      state: 'opening',
      attempts: 2,
      reason: null,
    });
    expect(await settled()).toMatchObject({
      state: 'opened',
      url: `https://github.com/${CONFIG}/pull/1`,
      reason: null,
    });
    await owner().post(pickPath(proposed.candidateId)).expect(200);
    await app.get(OpenConfigPullRequests).workDue();

    expect(github.opened).toHaveLength(1);
    expect(github.opened[0]).toMatchObject({
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      title: 'build: in-order',
    });
    expect(github.opened[0]?.body).toContain(
      'Draining in order stops the stall.',
    );
    expect(github.commits).toHaveLength(1);
    expect(github.commits[0]?.replacing).toBeNull();
    expect(github.commits[0]?.files).toEqual([
      {
        path: CONFIG_FILE,
        content: CONFIG_LINE.replace(
          'prompts/build.md',
          `prompts/${team.slug}/delivery/build.md`,
        ),
      },
      {
        path: `teams/core/prompts/${team.slug}/delivery/build.md`,
        content: 'Build it, draining in order.\n',
      },
    ]);
    expect(github.files.get(PROMPT_FILE)).toBe('Build it.');
    expect(
      (await searchOf(id)).candidates.find(
        (each) => each.candidateId === proposed.candidateId,
      ),
    ).toMatchObject({
      pullRequest: {
        id: one.body.id,
        state: 'opened',
        url: `https://github.com/${CONFIG}/pull/1`,
      },
    });
    expect(
      (await auditOf(one.body.id)).map((each) => [each.resource, each.action]),
    ).toEqual([
      ['config-pull-request', 'created'],
      ['config-pull-request', 'updated'],
    ]);

    const stopped = await owner().post(`${teamPath()}/searches/${id}/stop`);

    expect([204, 409]).toContain(stopped.status);
  }, 120_000);

  it('stops once its station leaves its line', async () => {
    const originals = [];
    for (let each = 0; each < 5; each += 1) {
      originals.push(await anOriginal(POLISH));
    }
    const setId = await openSet('Polished', originals, POLISH);
    const { id, seedReplayId } = await startSearch(
      setId,
      { iterations: 1, perIteration: 1, ceiling: 20 },
      POLISH,
    );
    const line = (
      await owner().get(`/api/resources/lines/${DELIVERY}`).expect(200)
    ).body as {
      version: number;
      definition: { stations: { key: string }[] };
    };

    await owner()
      .put(
        `/api/resources/lines/${DELIVERY}`,
        {
          ...line.definition,
          stations: line.definition.stations.filter(
            (each) => each.key !== 'polish',
          ),
        },
        line.version,
      )
      .expect(200);

    await eventually(async () => (await searchState(id)) === 'stopped', WITHIN);

    expect((await searchRow(id))?.ending).toBe('station-gone');
    expect(await replayEnded(seedReplayId)).not.toBe('running');
  }, 120_000);

  it('is abandoned with its team, withdrawing the agent run it held', async () => {
    const setId = await openSet('Disbanded', fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 2,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 4, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');
    await eventually(async () => {
      await app.get(AdvanceSearches).workDue();
      return (await searchRunsOf(id)).some((each) => each.state === 'queued');
    }, WITHIN);

    const [agentRun] = await searchRunsOf(id);

    await delivered({
      kind: TEAM_DISBANDED,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      key: 'core',
    } as DomainEvent);

    expect(await searchRow(id)).toBeUndefined();
    expect(
      await db
        .select()
        .from(schema.notice)
        .where(eq(schema.notice.teamId, team.teamId.value)),
    ).toEqual([]);
    await eventually(
      async () =>
        (
          await db
            .select()
            .from(schema.configPullRequest)
            .where(eq(schema.configPullRequest.teamId, team.teamId.value))
        ).length === 0,
      WITHIN,
    );
    await eventually(
      async () => (await replayRow(seedReplayId)) === undefined,
      WITHIN,
    );
    expect(
      (
        await db
          .select({ state: schema.run.state })
          .from(schema.run)
          .where(inArray(schema.run.id, [agentRun?.id ?? '']))
      )[0]?.state,
    ).not.toBe('queued');
  }, 120_000);
});
