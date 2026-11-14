import { randomUUID } from 'node:crypto';

import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import {
  PULL_REQUESTS,
  type PullRequestAt,
  type PullRequestOpening,
  type PullRequestPort,
  type PullRequestStatusDto,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryCommit,
  type RepositoryContentsPort,
} from '@github/application/ports/repository-contents.port';
import { JUDGE, type JudgePort } from '@insights/application/ports/judge.port';
import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { RefreshReplaySets } from '@replays/application/services/refresh-replay-sets.service';
import { WorkChangeJudgings } from '@replays/application/services/work-change-judgings.service';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';
import {
  WORKING_COPY_ARCHIVE_STORE,
  type WorkingCopyArchiveStorePort,
} from '@runs/application/ports/working-copy-archive-store.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './app';
import {
  type SearchedStation,
  type SearchPolicyTerms,
  searchRunsSettled,
  searchStarted,
} from './auto-searches';
import { eventually } from './eventually';
import { posted, said, spent } from './harness-events';
import { keptSet } from './kept-sets';
import { writtenStation } from './replays';
import { aDispatch, requestedByTask } from './runs';
import * as schema from './schema';
import { searchReadOf } from './search-read';
import { insertStations } from './stations';
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
  stored: async () => true,
  taken: async () => undefined,
  open: async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' }),
} as unknown as AttachmentStorePort;

const archiveStore: WorkingCopyArchiveStorePort = {
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
  judge: async (request) => {
    const scoredStep = request.steps.find((each) => SCORED.test(each.text));
    const value = Number(SCORED.exec(scoredStep?.text ?? '')?.[1] ?? 1);

    return {
      model: 'stub/judge',
      guidance: value <= 2 ? STUB_GUIDANCE : null,
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
  closed: [] as PullRequestAt[],
  comments: [] as { number: number; body: string }[],
  statuses: new Map<number, PullRequestStatusDto>(),
  failing: null as Error | null,
  commentFailing: null as Error | null,
};

export const GITHUB_ID_BASE = 1_000;

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
  filesUnder: async (_workspace, _repository, directory) =>
    [...github.files.entries()]
      .filter(([path]) => !directory || path.startsWith(`${directory}/`))
      .map(([path, content]) => ({ path, content })),
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

    const number = at < 0 ? github.opened.length : at + 1;

    return {
      url: `https://github.com/${CONFIG}/pull/${number}`,
      number,
      id: GITHUB_ID_BASE + number,
      repository: CONFIG,
    };
  },
  edit: async () => {},
  statusOf: async (at) => {
    if (github.failing) {
      throw github.failing;
    }

    return github.statuses.get(at.number) ?? { state: 'open', closedAt: null };
  },
  close: async (at) => {
    if (github.failing) {
      throw github.failing;
    }

    github.closed.push(at);
    github.statuses.set(at.number, { state: 'closed', closedAt: new Date() });
  },
  comment: async (at, body) => {
    if (github.commentFailing) {
      throw github.commentFailing;
    }

    github.comments.push({ number: at.number, body });
  },
  changedOn: async () => [],
  changedIn: async () => [],
};

// oxlint-disable-next-line import/no-mutable-exports -- openSearchFlow sets it in beforeAll; specs read the live binding
export let app: INestApplication;
// oxlint-disable-next-line import/no-mutable-exports -- openSearchFlow sets it in beforeAll; specs read the live binding
export let db: DrizzleDatabase;
// oxlint-disable-next-line import/no-mutable-exports -- openSearchFlow sets it in beforeAll; specs read the live binding
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
    branch: `feat/test-${taskId}`,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title: `Drain queue ${runId.slice(0, 4)}`,
    description: 'It stalls on restart.',
    originStationId: BUILD,
    createdById: team.owner.value,
    assigneeId: team.owner.value,
    finishedAt: at,
    workingCopyReleasedAt: at,
  });
  await db.insert(schema.run).values({
    id: runId,
    workspaceId: team.workspaceId.value,
    ...requestedByTask(taskId, { teamId: team.teamId.value }),
    harness: 'claude-code',
    state: 'completed',
    exitCode: 0,
    endedAt: at,
    spec: {
      checkouts: [
        {
          remote: 'spotlight:repository',
          path: 'api',
          branch: `feat/test-${taskId}`,
        },
      ],
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: {},
      startingPoint: true,
    },
    startedFromArchiveId: archiveId,
    startedFromCheckouts: [{ path: 'api', commit: COMMIT }],
    startedFromAttempt: 1,
    startedFromAt: at,
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId,
      workspaceId: team.workspaceId.value,
      taskId,
      stationId,
      briefedTask: BriefedTask.of({
        stationId: StationId.of(stationId),
        title: 'Drain the queue',
        description: 'It stalls on restart.',
        reviewing: null,
        attachments: [],
        notes: [],
        openReviewComments: [],
      }).parts,
      endedAt: at,
    }),
  );
  await db.insert(schema.workingCopyArchive).values({
    id: archiveId,
    workspaceId: team.workspaceId.value,
    workingCopyKey: `work/task-${taskId}`,
    grantedToRunId: runId,
    size: 1_024,
    sha256: 'a'.repeat(64),
    grantedAt: at,
    completedAt: at,
  });

  return { taskId, runId };
};

export const createSet = async (
  originals: readonly Original[],
  stationId = BUILD,
): Promise<string> =>
  keptSet(
    app,
    { workspaceId: team.workspaceId.value, stationId },
    originals.map((each) => each.runId),
  );

export const refreshedBefore = (setId: string): Promise<boolean> =>
  app.get(RefreshReplaySets).refreshBefore(ReplaySetId.of(setId));

export const setRunsOf = async (setId: string): Promise<string[]> =>
  (
    await db
      .select({ runId: schema.replaySetEntry.runId })
      .from(schema.replaySetEntry)
      .where(eq(schema.replaySetEntry.setId, setId))
  ).map((each) => each.runId);

export const searchedAt = (stationId = BUILD): SearchedStation => ({
  app,
  db,
  lineId: DELIVERY,
  stationId,
});

export const startSearch = (
  terms: SearchPolicyTerms,
  stationId = BUILD,
): Promise<{ id: string; seedReplayId: string }> =>
  searchStarted(searchedAt(stationId), terms);

export type SearchRead = Awaited<ReturnType<typeof searchReadOf>>;

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
      externalLink: { url: string; label: string } | null;
      askedAt: string;
      unread: boolean;
      resolved: boolean;
    };

export const teamNotices = async (): Promise<
  Extract<InboxEntry, { kind: 'notice' }>[]
> =>
  (
    (await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200))
      .body as { readonly items: InboxEntry[] }
  ).items.filter(
    (each): each is Extract<InboxEntry, { kind: 'notice' }> =>
      each.kind === 'notice',
  );

export const ADVISE_ON_STALL =
  'replays.advise-on-search-stalled-outside-config';

export const noticesSince = async (at: Date) =>
  (await teamNotices()).filter(
    (each) => Date.parse(each.askedAt) >= at.getTime(),
  );

export const subscriberDone = async (subscriber: string): Promise<boolean> => {
  const rows = await db
    .select()
    .from(schema.eventDelivery)
    .where(eq(schema.eventDelivery.subscriber, subscriber));

  return rows.length > 0 && rows.every((each) => each.deliveredAt !== null);
};

export const deliveredTo = async (
  subscriber: string,
  about: 'runId' | 'replayId',
  id: string,
): Promise<boolean> => {
  const rows = await db
    .select({ deliveredAt: schema.eventDelivery.deliveredAt })
    .from(schema.eventDelivery)
    .innerJoin(
      schema.eventOutbox,
      eq(schema.eventOutbox.id, schema.eventDelivery.eventId),
    )
    .where(
      and(
        eq(schema.eventDelivery.subscriber, subscriber),
        sql`${schema.eventOutbox.payload} -> ${about} ->> 'value' = ${id}`,
      ),
    );

  return rows.length > 0 && rows.every((each) => each.deliveredAt !== null);
};

export const searchOf = (id: string): Promise<SearchRead> =>
  searchReadOf(app, id);

export const turnedOff = async (id: string): Promise<void> => {
  await app.get<TransactionPort>(TRANSACTION).inTransaction(async () => {
    const searches = app.get(DrizzleSearchRepository);
    const search = await searches.locked(SearchId.of(id));

    if (search) {
      await searches.save(search.turnOff(new Date()));
    }
  });
  await eventually(() => searchRunsSettled(db, id));
};

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
  db
    .select()
    .from(schema.run)
    .where(
      and(
        eq(schema.run.requesterOwner, 'replays'),
        eq(schema.run.requesterKind, 'search'),
        eq(schema.run.requesterId, searchId),
      ),
    );

const queuedReplayRuns = async () =>
  db
    .select({ id: schema.run.id })
    .from(schema.run)
    .where(
      and(
        eq(schema.run.workspaceId, team.workspaceId.value),
        eq(schema.run.state, 'queued'),
        eq(schema.run.requesterOwner, 'replays'),
        eq(schema.run.requesterKind, 'replay'),
      ),
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
      events: posted(said(`Drained it: score(${score}).`), spent(cost)),
    })
    .expect(204);
  await bearing(token)
    .post(`/api/runs/${runId}/completion`, {
      exitCode: 0,
      failed: false,
      handover: { next: 'ship', note: 'Drained.' },
      sessionId: 'session_1',
    })
    .expect(204);
};

export const entryOf = async (runId: string) => {
  const [entry] = await db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.runId, runId));

  return entry;
};

type Plan = (
  replayId: string,
  repeat: number,
) => { score: number; cost: number };

const SETTLE_PAUSE_MS = 200;

const SETTLE_WITHIN_MS = 20_000;

const unsettledReplayEntries = async () =>
  db
    .select({ runId: schema.replayEntry.runId })
    .from(schema.replayEntry)
    .innerJoin(schema.replay, eq(schema.replay.id, schema.replayEntry.replayId))
    .where(
      and(
        eq(schema.replay.workspaceId, team.workspaceId.value),
        inArray(schema.replay.state, ['queued', 'running']),
        or(
          eq(schema.replayEntry.waiting, true),
          and(
            isNotNull(schema.replayEntry.runId),
            isNull(schema.replayEntry.succeeded),
            eq(schema.replayEntry.notRun, false),
          ),
        ),
      ),
    );

const settled = async (): Promise<boolean> => {
  const deadline = Date.now() + SETTLE_WITHIN_MS;

  while (Date.now() < deadline) {
    await judged();
    await app.get(DispatchReplayRuns).processDue();

    if ((await queuedReplayRuns()).length > 0) {
      return false;
    }
    if ((await unsettledReplayEntries()).length === 0) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, SETTLE_PAUSE_MS));
  }

  throw new Error('the replay entries never settled');
};

const REPLAY_STARTS = [
  'replays.start-planned-search-replays',
  'replays.start-replay-of-started-check',
];

const replaysStarted = async (): Promise<boolean> => {
  const rows = await db
    .select({ deliveredAt: schema.eventDelivery.deliveredAt })
    .from(schema.eventDelivery)
    .where(inArray(schema.eventDelivery.subscriber, REPLAY_STARTS));

  return rows.every((each) => each.deliveredAt !== null);
};

export const drained = async (plan: Plan): Promise<void> => {
  await eventually(replaysStarted, WITHIN);

  for (let turn = 0; turn < 200; turn += 1) {
    await app.get(DispatchReplayRuns).processDue();

    if ((await queuedReplayRuns()).length === 0) {
      if (await settled()) {
        return;
      }
      continue;
    }

    const assignment = await claimed();

    if (!assignment) {
      continue;
    }

    const entry = await entryOf(assignment.runId);

    if (!entry) {
      throw new Error(`claimed ${assignment.runId}, which is no replay run`);
    }

    const { score, cost } = plan(entry.replayId, entry.repeat);

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
      (each) =>
        each.state === 'queued' && each.requesterToken === String(iteration),
    );
  }, WITHIN);

  const assignment = await claimed();
  const [row] = await db
    .select()
    .from(schema.run)
    .where(eq(schema.run.id, assignment?.runId ?? ''));

  expect(row?.requesterId).toBe(searchId);

  return assignment as Claimed;
};

export const endedSearchRun = async (
  { token, runId }: Claimed,
  failed = false,
  cost = 0.05,
) => {
  await bearing(token)
    .post(`/api/runs/${runId}/events`, {
      events: posted(spent(cost)),
    })
    .expect(204);
  await bearing(token)
    .post(`/api/runs/${runId}/completion`, {
      exitCode: failed ? 1 : 0,
      failed,
      handover: failed ? undefined : { next: 'review', note: 'Proposed.' },
      sessionId: 'session_1',
    })
    .expect(204);
};

export const liveBlock = () => writtenStation(app, DELIVERY, 'build');

export const proposing = (assignment: Claimed, body: object) =>
  bearing(assignment.token).post(
    `/api/runs/${assignment.runId}/search-candidates`,
    body,
  );

export const auditOf = async (searchId: string) =>
  db
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

// oxlint-disable-next-line import/no-mutable-exports -- openSearchFlow sets it in beforeAll; specs read the live binding
export let tenTasks: Original[];
// oxlint-disable-next-line import/no-mutable-exports -- openSearchFlow sets it in beforeAll; specs read the live binding
export let fiveTasks: Original[];

export const openSearchFlow = (): void => {
  beforeAll(async () => {
    github.files.clear();
    github.commits.length = 0;
    github.opened.length = 0;
    github.closed.length = 0;
    github.comments.length = 0;
    github.statuses.clear();
    github.failing = null;
    github.commentFailing = null;
    app = await openApp((module) =>
      module
        .overrideProvider(WORKING_COPY_ARCHIVE_STORE)
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
    await insertStations(db, [
      {
        id: randomUUID(),
        workspaceId: team.workspaceId.value,
        lineId: DELIVERY,
        key: 'backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      },
      {
        id: BUILD,
        workspaceId: team.workspaceId.value,
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
        workspaceId: team.workspaceId.value,
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
        workspaceId: team.workspaceId.value,
        lineId: DELIVERY,
        key: 'ship',
        name: 'Ship',
        position: 3,
        kind: 'work',
        harness: 'claude-code',
      },
      {
        id: randomUUID(),
        workspaceId: team.workspaceId.value,
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
      .post(
        `/api/v1/resources/workspaces/${team.workspaceId.value}/runner-pools`,
      )
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
