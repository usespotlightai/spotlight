import { randomUUID } from 'node:crypto';
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
import { JUDGE, type JudgePort } from '@insights/application/ports/judge.port';
import { WorkChangeJudgings } from '@insights/application/services/work-change-judgings.service';
import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
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
import { afterAll, beforeAll, expect } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './app';
import { eventually } from './eventually';
import * as schema from './schema';
import { createTeam } from './team';

const HOST = `host-search-flow-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'f'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
export const DELIVERY = randomUUID();
export const BUILD = randomUUID();
export const POLISH = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const RUBRIC = 'scores: 1-5\nDoes it drain the queue in order?';
const SCORED = /score\((\d)\)/;
export const WITHIN = 60_000;
export const STUB_GUIDANCE = 'Keep the oldest job first after a restart.';

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
      guidance: value <= 2 ? STUB_GUIDANCE : null,
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

export const CONFIG = 'acme/platform';
export const CONFIG_FILE = 'teams/core/delivery.tf';
export const PROMPT_FILE = 'teams/core/prompts/build.md';

export const CONFIG_LINE = `resource "spotlight_line" "core_delivery" {
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
      rubric        = ${JSON.stringify(RUBRIC)}
      sample        = 0.1
      min_agreement = 0.6
    }
  }
}
`;

export const github = {
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
  filesIn: async (_workspace, _repository, directory) =>
    [...github.files.keys()].filter(
      (path) => path.slice(0, Math.max(path.lastIndexOf('/'), 0)) === directory,
    ),
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

export let app: INestApplication;
export let db: DrizzleDatabase;
export let team: Awaited<ReturnType<typeof createTeam>>;

export const http = () => served(app);

export const owner = () => ({
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

export const bearing = (token: string) => ({
  get: (path: string) =>
    http().get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

export const teamPath = () => `/api/teams/${team.teamId.value}`;
export const stationPath = (stationId = BUILD) =>
  `${teamPath()}/lines/${DELIVERY}/stations/${stationId}`;

interface Original {
  readonly taskId: string;
  readonly runId: string;
}

export const anOriginal = async (stationId = BUILD): Promise<Original> => {
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

export const createSet = async (
  name: string,
  originals: readonly Original[],
  stationId = BUILD,
): Promise<string> => {
  const created = await owner()
    .post(`${stationPath(stationId)}/replay-sets`, { name })
    .expect(201);
  const setId = created.body.id as string;

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

export const budgetOf = (budget: Budget) => ({
  iterations: budget.iterations,
  perIteration: budget.perIteration,
  ceiling: { amount: budget.ceiling, currency: 'USD' },
  concurrency: budget.concurrency ?? 10,
});

export const startSearch = async (
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

export interface SearchRead {
  state: string;
  stopReason: string | null;
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
      result: string | null;
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
    overfit: 'likely' | 'too-few-held-out' | null;
  }[];
  frontier: string[];
  best: {
    name: string;
    overfit: 'likely' | 'too-few-held-out' | null;
  } | null;
}

export type InboxEntry =
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

export const searchOf = async (id: string): Promise<SearchRead> =>
  (await owner().get(`${teamPath()}/searches/${id}`).expect(200))
    .body as SearchRead;

export const searchRow = async (id: string) => {
  const [row] = await db
    .select()
    .from(schema.replaySearch)
    .where(eq(schema.replaySearch.id, id));

  return row;
};

export const searchState = async (id: string) => (await searchRow(id))?.state;

export const replayRow = async (id: string) => {
  const [row] = await db
    .select()
    .from(schema.replay)
    .where(eq(schema.replay.id, id));

  return row;
};

export const originalsOf = async (replayId: string) =>
  (
    await db
      .select({ original: schema.replayEntry.originalRunId })
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, replayId))
  )
    .map((each) => each.original)
    .sort();

export const searchRunsOf = async (searchId: string) =>
  await db.select().from(schema.run).where(eq(schema.run.searchId, searchId));

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

export const claimed = async (): Promise<Claimed | null> => {
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

export const judged = async () => {
  await app.get(WorkChangeJudgings).processDue();
  await app.get(WorkChangeJudgings).idle();
};

export const finished = async (
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

export const entryOf = async (runId: string) => {
  const [entry] = await db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.runId, runId));

  return entry;
};

type Plan = (replayId: string) => { score: number; cost: number };

export const drained = async (plan: Plan): Promise<void> => {
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

export const replayEnded = (replayId: string) =>
  eventually(async () => {
    await judged();
    const state = (await replayRow(replayId))?.state;

    return state !== 'queued' && state !== 'running' ? state : null;
  }, WITHIN);

export const leasedSearchRun = async (
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

export const endedSearchRun = async (
  { token, runId }: Claimed,
  failed = false,
) => {
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

export const liveBlock = async () => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, BUILD);

  if (!live) {
    throw new Error('the build station is not live');
  }

  return live.station;
};

export const proposing = (assignment: Claimed, body: object) =>
  bearing(assignment.token).post(
    `/api/runs/${assignment.runId}/search-candidates`,
    body,
  );

export const auditOf = async (searchId: string) =>
  await db
    .select()
    .from(schema.configurationChange)
    .where(eq(schema.configurationChange.resourceId, searchId))
    .orderBy(schema.configurationChange.seq);

const handledAgain = async <T>(
  handle: () => Promise<T>,
  attempts = 3,
): Promise<T> => {
  try {
    return await handle();
  } catch (error) {
    if (attempts > 1 && (error as { kind?: string }).kind === 'conflict') {
      return handledAgain(handle, attempts - 1);
    }

    throw error;
  }
};

export const delivered = async (event: DomainEvent): Promise<void> => {
  for (const each of app.get(EventSubscribers).listeningTo(event.kind)) {
    for (const raised of await handledAgain(() => each.handle(event))) {
      await delivered(raised);
    }
  }
};

export const tokenWith = async (scopes: readonly string[]): Promise<string> => {
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

export let tenTasks: Original[];
export let fiveTasks: Original[];

export const openSearchFlow = (): void => {
  beforeAll(async () => {
    github.files.clear();
    github.commits.length = 0;
    github.opened.length = 0;
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
    team = await createTeam(
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
  });
};
