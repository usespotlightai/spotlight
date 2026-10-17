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
import {
  PAIR_JUDGE,
  type PairJudgeAsk,
  type PairJudgePort,
} from '@outcomes/application/ports/pair-judge.port';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { WorkPairJudgings } from '@outcomes/application/services/work-pair-judgings.service';
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

const HOST = `host-pairing-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'s'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
const DELIVERY = randomUUID();
const BUILD = randomUUID();
const SHIP = randomUUID();
const COMMIT = '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a';
const CLAIMS = [
  'It drains the queue.',
  'It keeps the order jobs came in.',
] as const;
const FAST = 'drainFast()';
const PLAIN = 'drain()';
const PREFERRED: Readonly<Record<string, 'win' | 'loss' | 'tie'>> = {
  'Drain queue first': 'win',
  'Drain queue second': 'loss',
  'Drain queue third': 'tie',
};

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

const asked: JudgeAsk[] = [];

const judge: JudgePort = {
  available: true,
  model: 'stub/judge',
  judge: async (ask) => {
    asked.push(ask);
    const fast = ask.hunks.some((each) =>
      each.lines.some((line) => line.includes(FAST)),
    );
    const cited = ask.hunks.slice(0, 1).map((each) => each.id);

    return {
      usage: {
        inputTokens: 2_000,
        outputTokens: 50,
        cost: { amount: 0.01, currency: 'USD' },
      },
      verdict: {
        claims: ask.claims.map((claim, index) => ({
          index,
          met: index === 0 || !fast,
          reasons: [{ text: `On "${claim}".`, steps: [], hunks: cited }],
        })),
      },
    };
  },
};

const pairsAsked: PairJudgeAsk[] = [];

const pairJudge: PairJudgePort = {
  available: true,
  model: 'stub/pair-judge',
  judgePair: async (ask) => {
    pairsAsked.push(ask);
    const fastIsA = ask.a.hunks.some((each) =>
      each.lines.some((line) => line.includes(FAST)),
    );
    const wanted = PREFERRED[ask.title] ?? 'tie';
    const preferred =
      wanted === 'tie'
        ? ('tie' as const)
        : (wanted === 'win') === fastIsA
          ? ('A' as const)
          : ('B' as const);

    return {
      usage: {
        inputTokens: 3_000,
        outputTokens: 60,
        cost: { amount: 0.02, currency: 'USD' },
      },
      verdict: {
        preferred,
        reasons: [
          {
            text: 'One drains in order, the other does not.',
            hunks: [ask.a.hunks[0]?.id ?? '', ask.b.hunks[0]?.id ?? ''],
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

const anOriginal = async (title: string): Promise<Original> => {
  const taskId = randomUUID();
  const runId = randomUUID();
  const archiveId = randomUUID();
  const at = new Date();

  await db.insert(schema.task).values({
    id: taskId,
    openedFrom: 'person',
    workspaceId: team.workspaceId.value,
    stationId: BUILD,
    title,
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
      title,
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
  await app
    .get(DrizzleRunRecordRepository)
    .add(
      RunRecord.heardOf(
        RunId.of(runId),
        team.workspaceId,
        TaskId.of(taskId),
      ).recordAction(NextAct.of('closed', at)),
    );

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
  await app.get(WorkPairJudgings).workDue();
  await app.get(WorkPairJudgings).idle();
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
      .useValue(judge)
      .overrideProvider(PAIR_JUDGE)
      .useValue(pairJudge),
  );
  db = app.get(DRIZZLE);
  team = await openTeam(
    db,
    app.get(DrizzleTaskRepository),
    `pairing-${randomUUID().slice(0, 8)}`,
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
        rubric: null,
        claims: [...CLAIMS],
        passShare: 0.5,
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
      name: 'pairing-box',
      session: 'session_1',
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

describe('a replay at a station whose judge goes by claims', () => {
  it('judges each run claim by claim, then sets each change blind beside the baseline’s for the same task and tallies wins, losses and ties', async () => {
    const originals = [
      await anOriginal('Drain queue first'),
      await anOriginal('Drain queue second'),
      await anOriginal('Drain queue third'),
    ];
    const opened = await owner()
      .post(`${stationPath()}/replay-sets`, { name: 'Paired' })
      .expect(201);
    const setId = opened.body.id as string;
    for (const each of originals) {
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/entries`, {
          runId: each.runId,
        })
        .expect(204);
    }
    const candidate = await proposed('Build it, draining the queue fast.');

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

    const both = [id, baselineId];
    const reported = new Set<string>();

    const finish = async (handed: Claimed) => {
      const entry = await entryOf(handed.runId);
      const line = entry?.replayId === id ? FAST : PLAIN;

      await bearing(handed.token)
        .post(`/api/runs/${handed.runId}/events`, {
          events: changing(1, 'Drained it.', line),
        })
        .expect(204);
      await bearing(handed.token)
        .post(`/api/runs/${handed.runId}/change-stacks`, {
          diff: diffOf(line),
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
      await bearing(handed.token)
        .post(
          `/api/runs/${handed.runId}/change-stack-checks/${handed.stackId}`,
          {
            steps: [{ step: 'whole', passed: true, output: 'ok', tookMs: 900 }],
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

    const allPaired = async () => {
      const entries = await db
        .select({
          succeeded: schema.replayEntry.succeeded,
          replayId: schema.replayEntry.replayId,
          pairing: schema.replayEntry.pairing,
        })
        .from(schema.replayEntry)
        .where(inArray(schema.replayEntry.replayId, both));

      return (
        entries.length === 6 &&
        entries.every((each) => each.succeeded !== null) &&
        entries
          .filter((each) => each.replayId === id)
          .every((each) => each.pairing?.verdict)
      );
    };

    await eventually(async () => {
      await app.get(DispatchReplayRuns).workDue();
      await worked();

      if (await workWaiting()) {
        const handed = await claimed();

        await (handed.kind === 'run' ? finish(handed) : check(handed));
      }

      return allPaired();
    }, 120_000);

    const detail = (
      await owner().get(`${teamPath()}/replays/${id}`).expect(200)
    ).body as {
      totals: { successRate: number };
      pairedWith: string | null;
      pairsAgainstBaseline: { wins: number; losses: number; ties: number };
      comparison: {
        title: string;
        pair: string | null;
        candidate: {
          judge: {
            scale: string;
            score: number;
            marks: boolean[];
            passShare: number;
            passed: boolean;
            claims: string[];
            reasons: { claim: number | null; citations: { kind: string }[] }[];
          };
          pair: {
            state: string;
            outcome: string;
            againstRunId: string;
            readings: { ownShownFirst: boolean; outcome: string }[];
          };
          pairingSpent: { spends: { amount: number }[] } | null;
        }[];
        baseline: {
          runId: string;
          judge: { marks: boolean[]; passed: boolean };
          pair: unknown;
        }[];
      }[];
    };

    expect(detail.totals.successRate).toBe(1);
    expect(detail.pairedWith).toBe(baselineId);
    expect(detail.pairsAgainstBaseline).toEqual({
      wins: 1,
      losses: 1,
      ties: 1,
    });
    expect(
      Object.fromEntries(
        detail.comparison.map((each) => [each.title, each.pair]),
      ),
    ).toEqual({
      'Drain queue first': 'win',
      'Drain queue second': 'loss',
      'Drain queue third': 'tie',
    });

    for (const row of detail.comparison) {
      const [mine] = row.candidate;
      const [theirs] = row.baseline;

      expect(mine?.judge).toMatchObject({
        scale: 'claims',
        score: 0.5,
        marks: [true, false],
        passShare: 0.5,
        passed: true,
        claims: [...CLAIMS],
      });
      expect(mine?.judge.reasons.map((each) => each.claim)).toEqual([0, 1]);
      expect(mine?.judge.reasons[0]?.citations[0]?.kind).toBe('hunk');
      expect(
        mine?.pair.readings.map((each) => each.ownShownFirst).sort(),
      ).toEqual([false, true]);
      expect(theirs?.judge).toMatchObject({
        marks: [true, true],
        passed: true,
      });
      expect(mine?.pair).toMatchObject({
        state: 'judged',
        outcome: row.pair,
        againstRunId: theirs?.runId,
      });
      expect(mine?.pairingSpent?.spends[0]?.amount).toBe(0.04);
      expect(theirs?.pair).toBeNull();
    }

    expect(asked.every((each) => each.scale === 'claims')).toBe(true);
    expect(asked.every((each) => each.claims.length === 2)).toBe(true);
    expect(pairsAsked).toHaveLength(6);
    expect(
      pairsAsked.every(
        (each) =>
          each.claims.length === 2 &&
          each.reference.hunks.some((hunk) =>
            hunk.lines.includes('+drainInOrder()'),
          ),
      ),
    ).toBe(true);

    const runs = (
      await db
        .select({ runId: schema.replayEntry.runId })
        .from(schema.replayEntry)
        .where(eq(schema.replayEntry.replayId, id))
    ).flatMap((each) => (each.runId ? [each.runId] : []));
    expect(
      await db
        .select()
        .from(schema.pairJudging)
        .where(inArray(schema.pairJudging.runId, runs)),
    ).toHaveLength(3);

    await app
      .get(ForgetOutcomes)
      .judgingsAndScoresOfTeam(team.workspaceId, team.teamId);
    expect(
      await db
        .select()
        .from(schema.pairJudging)
        .where(inArray(schema.pairJudging.runId, runs)),
    ).toEqual([]);
  }, 180_000);
});
