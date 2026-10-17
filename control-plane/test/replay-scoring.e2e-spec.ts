import { randomUUID } from 'node:crypto';
import {
  CHANGE_STACK_DRAFTER,
  type ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import type { INestApplication } from '@nestjs/common';
import {
  JUDGE,
  type JudgeAsk,
  type JudgePort,
} from '@outcomes/application/ports/judge.port';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
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
import type { JournalEntry } from '@work/application/ports/run-journal.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const HOST = `host-scoring-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'s'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const RUBRIC = 'scores: 1-5\nDoes it drain the queue in order?';

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

const drafter: ChangeStackDrafterPort = {
  available: true,
  draft: async ({ diff }) => ({
    usage: {
      inputTokens: 1_000,
      outputTokens: 100,
      cost: { amount: 0.02, currency: 'USD' },
    },
    cohorts: [
      {
        kind: 'change',
        title: 'Drain the queue',
        intent: 'Drain it in order',
        layers: [
          {
            title: 'Drain in order',
            summary: 'Drains the queue oldest first',
            dependsOn: [],
            ranges: diff.hunks.map((each) => ({ hunk: each.id })),
            notes: [
              ...new Set(
                diff.hunks.flatMap((each) => diff.fileOf(each.id)?.path ?? []),
              ),
            ].map((path) => ({ path, note: 'Drains the queue' })),
          },
        ],
      },
    ],
  }),
};

const SCORED = /score\((\d)\)/;

const asked: JudgeAsk[] = [];

const judge: JudgePort = {
  available: true,
  model: 'stub/judge',
  judge: async (ask) => {
    asked.push(ask);
    const said = ask.steps.find((each) => SCORED.test(each.text));
    const value = Number(SCORED.exec(said?.text ?? '')?.[1] ?? 1);

    return {
      usage: {
        inputTokens: 2_000,
        outputTokens: 50,
        cost: { amount: 0.01, currency: 'USD' },
      },
      verdict: {
        value,
        reasons: [
          {
            text: `It drains the queue as a ${value}.`,
            steps: said ? [said.index] : [],
            hunks: ask.hunks.slice(0, 1).map((each) => each.id),
          },
        ],
      },
    };
  },
};

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
  post: (path: string, body?: object) =>
    http()
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body ?? {}),
});

const teamPath = () => `/api/teams/${team.teamId.value}`;
const stationPath = () => `${teamPath()}/lines/${DELIVERY}/stations/${BUILD}`;

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

const changing = (from: number, said: string, line: string) => [
  {
    seq: from,
    type: 'output',
    at: new Date().toISOString(),
    data: sent({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: said },
    }),
  },
  {
    seq: from + 1,
    type: 'output',
    at: new Date().toISOString(),
    data: sent({
      sessionUpdate: 'tool_call',
      toolCallId: 'call_1',
      title: 'Edit',
      rawInput: { file: 'queue.js' },
    }),
  },
  {
    seq: from + 2,
    type: 'output',
    at: new Date().toISOString(),
    data: sent({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_1',
      status: 'completed',
      content: [
        {
          type: 'diff',
          path: '/workspace/api/queue.js',
          oldText: 'stall()\n',
          newText: `${line}\n`,
        },
      ],
    }),
  },
];

const diffOf = (line: string) =>
  [
    'diff --git a/queue.js b/queue.js',
    'index 1111111..2222222 100644',
    '--- a/queue.js',
    '+++ b/queue.js',
    '@@ -1 +1 @@',
    '-stall()',
    `+${line}`,
    '',
  ].join('\n');

interface Original {
  readonly taskId: string;
  readonly runId: string;
}

const anOriginal = async (accepted: boolean): Promise<Original> => {
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
      handover: { options: ['ship'], noteLimit: 0 },
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
  await new DrizzleRunJournal(new DrizzleContext(db)).append(
    RunAttempt.of(RunId.of(runId), 1),
    changing(1, 'Drained it.', 'drainInOrder()').map(
      (each): JournalEntry => ({ ...each, at: new Date(each.at) }),
    ),
  );

  if (accepted) {
    await app
      .get(DrizzleRunRecordRepository)
      .add(
        RunRecord.heardOf(
          RunId.of(runId),
          team.workspaceId,
          TaskId.of(taskId),
        ).recordAction(NextAct.of('closed', at)),
      );
  }

  return { taskId, runId };
};

const proposed = async (prompt: string): Promise<string> => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, BUILD);
  const answer = await http()
    .post(`/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`)
    .set(TEST_USER_HEADER, team.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({
      name: `Drain in order ${randomUUID().slice(0, 8)}`,
      station: { ...live?.station, prompt },
    });

  expect(answer.status).toBe(201);

  return answer.body.id as string;
};

interface Claimed {
  readonly token: string;
  readonly kind: 'run' | 'check';
  readonly runId: string;
  readonly stackId: string | null;
}

const claimed = async (): Promise<Claimed> => {
  const handed = (
    await http()
      .post('/api/hosts/claim')
      .set('Authorization', `Bearer ${POOL_TOKEN}`)
      .send({ host: HOST, image: IMAGE })
      .expect(200)
  ).body as {
    token: string;
    work: {
      kind: 'run' | 'check';
      run: { id: string } | null;
      check: { runId: string; stackId: string } | null;
    };
  };

  return {
    token: handed.token,
    kind: handed.work.kind,
    runId: handed.work.run?.id ?? handed.work.check?.runId ?? '',
    stackId: handed.work.check?.stackId ?? null,
  };
};

const entryOf = async (runId: string) => {
  const [entry] = await db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.runId, runId));

  return entry;
};

const replayState = async (replayId: string) => {
  const [row] = await db
    .select({ state: schema.replay.state })
    .from(schema.replay)
    .where(eq(schema.replay.id, replayId));

  return row?.state;
};

const worked = async () => {
  await app.get(WorkChangeStacks).workDue();
  await app.get(WorkChangeStacks).idle();
  await app.get(WorkChangeJudgings).workDue();
  await app.get(WorkChangeJudgings).idle();
};

beforeAll(async () => {
  app = await openApp((module) =>
    module
      .overrideProvider(WORKSPACE_ARCHIVE_STORE)
      .useValue(archiveStore)
      .overrideProvider(ATTACHMENT_STORE)
      .useValue(attachmentStore)
      .overrideProvider(CHANGE_STACK_DRAFTER)
      .useValue(drafter)
      .overrideProvider(JUDGE)
      .useValue(judge),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `scoring-${randomUUID().slice(0, 8)}`,
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
      diffs: true,
      check: 'npm test',
      judge: {
        rubric: RUBRIC,
        claims: [],
        passShare: 1,
        sample: 0.1,
        trust: 0.6,
      },
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
      name: 'scoring-box',
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
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('a replay at a station that checks and judges', () => {
  it('drafts each replay’s change, checks it with the candidate’s own check, judges it against the change people accepted, and puts the task that regressed first', async () => {
    const first = await anOriginal(true);
    const second = await anOriginal(false);
    const opened = await owner()
      .post(`${stationPath()}/replay-sets`, { name: 'Scored' })
      .expect(201);
    const setId = opened.body.id as string;
    for (const each of [first, second]) {
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/entries`, {
          runId: each.runId,
        })
        .expect(204);
    }
    const candidate = await proposed('Build it, draining the queue in order.');

    const started = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate,
          ceiling: { amount: 5, currency: 'USD' },
        })
        .expect(201)
    ).body as { id: string; baseline: { id: string } | null };
    const id = started.id;
    const baselineId = started.baseline?.id as string;
    await eventually(async () => (await replayState(baselineId)) !== undefined);

    const plan = (replayId: string, original: string) => {
      const ofCandidate = replayId === id;
      const ofSecond = original === second.runId;

      return {
        score: ofCandidate ? (ofSecond ? 2 : 5) : 4,
        passes: !(ofCandidate && ofSecond),
      };
    };

    const both = [id, baselineId];
    const reported = new Set<string>();

    const finish = async (handed: Claimed) => {
      const entry = await entryOf(handed.runId);
      const { score } = plan(entry?.replayId ?? '', entry?.originalRunId ?? '');

      await bearing(handed.token)
        .post(`/api/runs/${handed.runId}/events`, {
          events: changing(1, `Drained it: score(${score}).`, 'drain()'),
        })
        .expect(204);
      await bearing(handed.token)
        .post(`/api/runs/${handed.runId}/change-stacks`, {
          diff: diffOf('drain()'),
          repository: 'api',
          base: COMMIT,
        })
        .expect(204);
      await bearing(handed.token)
        .post(`/api/runs/${handed.runId}/completion`, {
          exitCode: 0,
          failed: false,
          outcome: { next: 'ship', note: 'Drained.' },
          sessionId: 'session_1',
          kept: true,
        })
        .expect(200);
    };

    const check = async (handed: Claimed) => {
      const entry = await entryOf(handed.runId);
      const { passes } = plan(
        entry?.replayId ?? '',
        entry?.originalRunId ?? '',
      );

      expect(entry?.succeeded).toBeNull();
      expect(await replayState(entry?.replayId ?? '')).toBe('running');

      await bearing(handed.token)
        .post(
          `/api/runs/${handed.runId}/change-stack-checks/${handed.stackId}`,
          {
            steps: [
              {
                step: 'whole',
                passed: passes,
                output: passes ? 'ok' : '1 failing',
                tookMs: 900,
              },
            ],
          },
        )
        .expect(204);
      reported.add(handed.stackId ?? '');
    };

    const replayRunIds = async () =>
      (
        await db
          .select({ runId: schema.replayEntry.runId })
          .from(schema.replayEntry)
          .where(inArray(schema.replayEntry.replayId, both))
      ).flatMap((each) => (each.runId ? [each.runId] : []));

    const workWaiting = async () => {
      const runs = await replayRunIds();

      if (runs.length === 0) {
        return false;
      }

      const queued = await db
        .select({ id: schema.run.id })
        .from(schema.run)
        .where(
          and(inArray(schema.run.id, runs), eq(schema.run.state, 'queued')),
        );
      const checks = (
        await db
          .select({ stackId: schema.stackCheck.stackId })
          .from(schema.stackCheck)
          .where(
            and(
              inArray(schema.stackCheck.runId, runs),
              eq(schema.stackCheck.phase, 'waiting'),
            ),
          )
      ).filter((each) => !reported.has(each.stackId));

      return queued.length > 0 || checks.length > 0;
    };

    const allScored = async () => {
      const entries = await db
        .select({ succeeded: schema.replayEntry.succeeded })
        .from(schema.replayEntry)
        .where(inArray(schema.replayEntry.replayId, both));

      return (
        entries.length === 4 && entries.every((each) => each.succeeded !== null)
      );
    };

    await eventually(async () => {
      await app.get(DispatchReplayRuns).workDue();
      await worked();

      if (await workWaiting()) {
        const handed = await claimed();

        await (handed.kind === 'run' ? finish(handed) : check(handed));
      }

      return allScored();
    }, 90_000);

    expect(reported.size).toBe(4);

    await eventually(
      async () =>
        (await replayState(id)) === 'finished' &&
        (await replayState(baselineId)) === 'finished',
    );

    const detail = (
      await owner().get(`${teamPath()}/replays/${id}`).expect(200)
    ).body as {
      judges: boolean;
      checks: boolean;
      totals: { scored: number; unscored: number; successRate: number };
      comparison: {
        originalRunId: string;
        regressed: boolean;
        scoreDelta: number | null;
        candidate: {
          result: string;
          checks: { state: string; failedAt: string[] };
          judge: { score: number; referenced: boolean; passed: boolean };
          draftingSpent: {
            spends: { amount: number; currency: string }[];
            unpriced: number;
          } | null;
          judgingSpent: {
            spends: { amount: number; currency: string }[];
            unpriced: number;
          } | null;
          reasons: { code: string; detail: string | null; steps: number[] }[];
        }[];
        baseline: { result: string }[];
      }[];
    };

    expect(detail.judges).toBe(true);
    expect(detail.checks).toBe(true);
    expect(detail.totals).toMatchObject({
      scored: 2,
      unscored: 0,
      successRate: 0.5,
    });
    expect(
      detail.comparison.map((each) => [
        each.originalRunId,
        each.regressed,
        each.scoreDelta,
        each.candidate[0]?.result,
        each.baseline[0]?.result,
      ]),
    ).toEqual([
      [second.runId, true, -2, 'failed', 'succeeded'],
      [first.runId, false, 1, 'succeeded', 'succeeded'],
    ]);

    const [regressed, kept] = detail.comparison;
    expect(kept?.candidate[0]?.draftingSpent).toEqual({
      spends: [{ amount: 0.02, currency: 'USD' }],
      unpriced: 0,
    });
    expect(kept?.candidate[0]?.judgingSpent).toEqual({
      spends: [{ amount: 0.01, currency: 'USD' }],
      unpriced: 0,
    });
    expect(regressed?.candidate[0]?.checks).toEqual({
      state: 'failed',
      failedAt: ['the whole change'],
      why: null,
    });
    expect(regressed?.candidate[0]?.judge).toMatchObject({
      score: 2,
      passed: false,
      referenced: false,
    });
    expect(regressed?.candidate[0]?.reasons.map((each) => each.code)).toEqual([
      'check-failed',
      'judge-failed',
    ]);
    expect(kept?.candidate[0]?.judge).toMatchObject({
      score: 5,
      passed: true,
      referenced: true,
    });

    const referenced = asked.find((each) => each.reference !== null);
    expect(referenced?.reference?.hunks[0]?.lines).toContain('+drainInOrder()');
    expect(asked.every((each) => each.rubric === RUBRIC)).toBe(true);

    const replayRuns = (
      await db
        .select({ runId: schema.replayEntry.runId })
        .from(schema.replayEntry)
        .where(inArray(schema.replayEntry.replayId, [id, baselineId]))
    ).flatMap((each) => (each.runId ? [each.runId] : []));

    expect(replayRuns).toHaveLength(4);
    expect(
      await db
        .select()
        .from(schema.score)
        .where(inArray(schema.score.runId, replayRuns)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.judging)
        .where(inArray(schema.judging.runId, replayRuns)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.runRecord)
        .where(inArray(schema.runRecord.runId, replayRuns)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.changeJudging)
        .where(inArray(schema.changeJudging.runId, replayRuns)),
    ).toHaveLength(4);
    await app
      .get(ForgetOutcomes)
      .judgingsAndScoresOfTeam(team.workspaceId, team.teamId);
    expect(
      await db
        .select()
        .from(schema.changeJudging)
        .where(inArray(schema.changeJudging.runId, replayRuns)),
    ).toEqual([]);
    expect(
      (
        await db
          .select({ replay: schema.changeStack.replay })
          .from(schema.changeStack)
          .where(inArray(schema.changeStack.runId, replayRuns))
      ).map((each) => each.replay),
    ).toEqual([true, true, true, true]);
  }, 120_000);
});

describe('a task run’s change', () => {
  it('is checked with the check its run was dispatched with, though its station’s check changed since', async () => {
    const taskId = randomUUID();
    const runId = randomUUID();

    await db.insert(schema.task).values({
      id: taskId,
      openedFrom: 'person',
      workspaceId: team.workspaceId.value,
      stationId: BUILD,
      title: 'Retry uploads',
      raisedAtStationId: BUILD,
      raisedById: team.owner.value,
      assigneeId: team.owner.value,
    });
    await db.insert(schema.run).values({
      id: runId,
      workspaceId: team.workspaceId.value,
      taskId,
      taskRevision: 0,
      stationId: BUILD,
      harness: 'claude-code',
      state: 'queued',
      spec: {
        checkouts: [
          {
            remote: 'spotlight:repository',
            path: 'api',
            branch: `spotlight/${taskId}`,
            setup: 'npm ci',
          },
        ],
        command: { executable: 'claude-agent-acp', args: [] },
        briefing: 'Retry uploads.',
        handover: { options: ['ship'], noteLimit: 0 },
        continuity: { key: `task-${taskId}` },
        diffs: true,
        check: 'npm test',
      },
    });

    const held = await claimed();
    expect(held.runId).toBe(runId);

    await db
      .update(schema.station)
      .set({ check: 'npm run lint' })
      .where(eq(schema.station.id, BUILD));

    try {
      await bearing(held.token)
        .post(`/api/runs/${runId}/change-stacks`, {
          diff: diffOf('retry(upload)'),
          repository: 'api',
          base: COMMIT,
        })
        .expect(204);

      const [stack] = await db
        .select()
        .from(schema.changeStack)
        .where(eq(schema.changeStack.runId, runId));

      expect(stack?.checkCommand).toBe('npm test');
      expect(stack?.checkSetup).toBe('npm ci');
      expect(stack?.replay).toBe(false);
    } finally {
      await db
        .update(schema.station)
        .set({ check: 'npm test' })
        .where(eq(schema.station.id, BUILD));
    }
  });
});
