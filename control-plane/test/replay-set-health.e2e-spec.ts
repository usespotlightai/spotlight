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

const HOST = `host-health-${randomUUID().slice(0, 8)}`;
const IMAGE = 'ghcr.io/acme/runner:main';
const POOL_TOKEN = `${'h'.repeat(8)}${randomUUID().replaceAll('-', '')}`;
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

const MARKED = /run\(([0-9a-f-]+)\)/;

const judgedRuns = new Map<string, number>();

let judgeFlipsLeft = 4;

const judge: JudgePort = {
  available: true,
  model: 'stub/judge',
  judge: async (ask: JudgeAsk) => {
    const said = ask.steps.find((each) => SCORED.test(each.text));
    const run = MARKED.exec(said?.text ?? '')?.[1] ?? '';
    const times = (judgedRuns.get(run) ?? 0) + 1;
    const scored = Number(SCORED.exec(said?.text ?? '')?.[1] ?? 1);
    const flips = times > 1 && judgeFlipsLeft > 0;
    const value = flips ? 2 : scored;

    judgeFlipsLeft -= flips ? 1 : 0;

    judgedRuns.set(run, times);

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

const changing = (said: string, line: string) => [
  {
    seq: 1,
    type: 'output',
    at: new Date().toISOString(),
    data: sent({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: said },
    }),
  },
  {
    seq: 2,
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
    seq: 3,
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

const anOriginal = async (): Promise<Original> => {
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
    changing('Drained it.', 'drainInOrder()').map(
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

const openSet = async (name: string, originals: readonly Original[]) => {
  const opened = await owner()
    .post(`${stationPath()}/replay-sets`, { name })
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

interface Claimed {
  readonly token: string;
  readonly kind: 'run' | 'check';
  readonly runId: string;
  readonly stackId: string | null;
  readonly recheck: boolean;
}

const claimed = async (): Promise<Claimed | null> => {
  const answer = await http()
    .post('/api/hosts/claim')
    .set('Authorization', `Bearer ${POOL_TOKEN}`)
    .send({ host: HOST, image: IMAGE });

  if (answer.status === 204) {
    return null;
  }

  const handed = answer.body as {
    token: string;
    work: {
      kind: 'run' | 'check';
      run: { id: string } | null;
      check: { runId: string; stackId: string; recheck: boolean } | null;
    };
  };

  return {
    token: handed.token,
    kind: handed.work.kind,
    runId: handed.work.run?.id ?? handed.work.check?.runId ?? '',
    stackId: handed.work.check?.stackId ?? null,
    recheck: handed.work.check?.recheck ?? false,
  };
};

const entryOf = async (runId: string) => {
  const [entry] = await db
    .select()
    .from(schema.replayEntry)
    .where(eq(schema.replayEntry.runId, runId));

  return entry;
};

const worked = async () => {
  await app.get(WorkChangeStacks).workDue();
  await app.get(WorkChangeStacks).idle();
  await app.get(WorkChangeJudgings).workDue();
  await app.get(WorkChangeJudgings).idle();
};

type Plan = (runId: string, replayId: string) => number;

const checked = new Map<string, number>();

let checkFlipsLeft = 1;

const staleRetries: number[] = [];

const finish = async (handed: Claimed, plan: Plan) => {
  const entry = await entryOf(handed.runId);
  const score = plan(handed.runId, entry?.replayId ?? '');

  await bearing(handed.token)
    .post(`/api/runs/${handed.runId}/events`, {
      events: changing(
        `Drained it: score(${score}) run(${handed.runId}).`,
        'drain()',
      ),
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
  const stack = handed.stackId ?? '';
  const times = (checked.get(stack) ?? 0) + 1;
  const passes = !(times > 1 && checkFlipsLeft > 0);

  checkFlipsLeft -= passes ? 0 : 1;
  checked.set(stack, times);
  expect(handed.recheck).toBe(times > 1);

  const path = `/api/runs/${handed.runId}/change-stack-checks/${stack}`;

  if (handed.recheck) {
    staleRetries.push(
      (
        await bearing(handed.token).post(path, {
          steps: [{ step: 'whole', passed: true }],
        })
      ).status,
    );
    await bearing(handed.token).post(`${path}/lease?recheck=true`).expect(200);
  }

  await bearing(handed.token)
    .post(handed.recheck ? `${path}?recheck=true` : path, {
      steps: [
        {
          step: 'whole',
          passed: passes,
          output: passes ? 'ok' : '1 failing',
          tookMs: 900,
        },
      ],
    })
    .expect(204);
};

const entriesOf = (replayIds: readonly string[]) =>
  db
    .select()
    .from(schema.replayEntry)
    .where(inArray(schema.replayEntry.replayId, [...replayIds]));

const workWaiting = async (replayIds: readonly string[]) => {
  const runs = (await entriesOf(replayIds)).flatMap((each) =>
    each.runId ? [each.runId] : [],
  );

  if (runs.length === 0) {
    return false;
  }

  const queued = await db
    .select({ id: schema.run.id })
    .from(schema.run)
    .where(and(inArray(schema.run.id, runs), eq(schema.run.state, 'queued')));
  const checks = await db
    .select({ stackId: schema.stackCheck.stackId })
    .from(schema.stackCheck)
    .where(
      and(
        inArray(schema.stackCheck.runId, runs),
        eq(schema.stackCheck.phase, 'waiting'),
      ),
    );

  return queued.length > 0 || checks.length > 0;
};

const workUntil = async (
  replayIds: readonly string[],
  done: (entries: Awaited<ReturnType<typeof entriesOf>>) => boolean,
  plan: Plan,
) => {
  for (let turn = 0; turn < 400; turn += 1) {
    await app.get(DispatchReplayRuns).workDue();
    await worked();

    if (done(await entriesOf(replayIds))) {
      return;
    }
    if (await workWaiting(replayIds)) {
      const handed = await claimed();

      if (handed) {
        await (handed.kind === 'run' ? finish(handed, plan) : check(handed));
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error('the replays never ended');
};

const probedAgain = (entries: Awaited<ReturnType<typeof entriesOf>>) =>
  entries.length > 0 &&
  entries.every(
    (each) =>
      (each.secondJudging?.verdict || each.secondJudging?.unjudged) &&
      each.recheck &&
      each.recheck.state !== 'checking',
  );

const scoredAll = (entries: Awaited<ReturnType<typeof entriesOf>>) =>
  entries.length > 0 && entries.every((each) => each.succeeded !== null);

interface SetRead {
  id: string;
  health: {
    noise: { repeats: number; spread: number } | null;
    saturation: { rate: number; saturated: boolean } | null;
    judge: {
      compared: number;
      agreed: number;
      pending: number;
      agreement: number | null;
      unstable: boolean;
    } | null;
    checks: {
      rechecked: number;
      pending: number;
      flaky: {
        taskId: string;
        originalRunId: string;
        runId: string;
        first: string;
        recheck: string;
      }[];
    } | null;
    oracle: {
      replayId: string;
      state: string;
      againstReplayId: string | null;
      againstState: string | null;
      answered: number;
      live: number | null;
      withAnswer: number | null;
      roomToImprove: boolean | null;
      gain: { verdict: string } | null;
    } | null;
  };
}

const setOf = async (setId: string): Promise<SetRead> => {
  const sets = (await owner().get(`${stationPath()}/replay-sets`).expect(200))
    .body as SetRead[];
  const found = sets.find((each) => each.id === setId);

  if (!found) {
    throw new Error(`no set ${setId}`);
  }

  return found;
};

let originals: Original[];
let setId: string;
let probeId: string;

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
    `health-${randomUUID().slice(0, 8)}`,
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
      model: 'sonnet',
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
      name: 'health-box',
      session: 'session_1',
      release: '0.1.0',
      executor: 'docker',
      capacity: 8,
      running: [],
      images: [
        {
          image: IMAGE,
          usual: true,
          harnesses: [{ id: 'claude-code', models: ['sonnet', 'opus'] }],
        },
      ],
    })
    .expect(200);

  originals = [];
  for (let made = 0; made < 5; made += 1) {
    originals.push(await anOriginal());
  }
  setId = await openSet('Probed', originals);
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('checking a replay set’s health', () => {
  it('checks a set with its first baseline: replays the live config three times, judges and checks every change a second time, and says how often each agreed with itself', async () => {
    const started = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate: 'live',
          ceiling: { amount: 20, currency: 'USD' },
        })
        .expect(201)
    ).body as {
      id: string;
      ceiling: { amount: number };
      baseline: { id: string; status: string } | null;
    };

    probeId = started.id;
    expect(started.ceiling.amount).toBe(60);
    expect(started.baseline).toMatchObject({
      id: probeId,
      status: 'started',
    });

    await workUntil([probeId], probedAgain, () => 5);

    const runs = (await entriesOf([probeId])).flatMap((each) =>
      each.runId ? [each.runId] : [],
    );

    const detail = (
      await owner().get(`${teamPath()}/replays/${probeId}`).expect(200)
    ).body as {
      probe: boolean;
      repeats: number;
      state: string;
      entries: {
        runId: string;
        judge: { score: number };
        secondJudge: { score: number } | null;
        recheck: { state: string } | null;
        result: string;
      }[];
    };

    expect(detail).toMatchObject({
      probe: true,
      repeats: 3,
      state: 'finished',
    });
    expect(
      detail.entries.filter(
        (each) => each.secondJudge?.score !== each.judge.score,
      ),
    ).toHaveLength(4);
    expect(detail.entries.every((each) => each.result === 'succeeded')).toBe(
      true,
    );

    const flipped = detail.entries.filter(
      (each) => each.recheck?.state === 'failed',
    );

    expect(flipped).toHaveLength(1);
    expect(runs).toHaveLength(15);

    const health = (await setOf(setId)).health;

    expect(health.noise).toMatchObject({ repeats: 3, spread: 0 });
    expect(health.saturation).toMatchObject({ rate: 1, saturated: true });
    expect(health.judge).toEqual({
      replayId: probeId,
      compared: 15,
      agreed: 11,
      pending: 0,
      agreement: 11 / 15,
      unstable: true,
    });
    expect(health.checks?.rechecked).toBe(15);
    expect(staleRetries).toHaveLength(15);
    expect(staleRetries.every((each) => each !== 204)).toBe(true);
    expect(health.checks?.flaky).toEqual([
      {
        taskId: (await entryOf(flipped[0]?.runId ?? ''))?.taskId,
        originalRunId: (await entryOf(flipped[0]?.runId ?? ''))?.originalRunId,
        runId: flipped[0]?.runId,
        first: 'passed',
        recheck: 'failed',
      },
    ]);
    expect(
      await db
        .select({ round: schema.changeJudging.round })
        .from(schema.changeJudging)
        .where(inArray(schema.changeJudging.runId, runs)),
    ).toHaveLength(30);
    expect(
      (
        await db
          .select({ recheck: schema.stackCheck.recheck })
          .from(schema.stackCheck)
          .where(inArray(schema.stackCheck.runId, runs))
      ).filter((each) => each.recheck),
    ).toHaveLength(15);

    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: {
            iterations: 1,
            perIteration: 1,
            ceiling: { amount: 10, currency: 'USD' },
          },
        })
        .expect(200)
    ).body as { objective: string; warnings: { kind: string }[] };

    expect(estimate.objective).toBe('cost');
    expect(estimate.warnings.map((each) => each.kind)).toEqual([
      'saturated',
      'judge-unstable',
      'flaky-checks',
    ]);
  }, 180_000);

  it('replays the live config handed each run’s answer once a replay of the whole set finishes, and says how much room the set leaves', async () => {
    const started = await eventually(async () => {
      await worked();
      return (await setOf(setId)).health.oracle;
    }, 30_000);

    expect(started).toMatchObject({
      againstReplayId: probeId,
      answered: originals.length,
    });

    await workUntil([started.replayId], scoredAll, () => 5);

    const oracle = await eventually(async () => {
      await worked();
      const read = (await setOf(setId)).health.oracle;

      return read?.state === 'finished' && read.gain ? read : null;
    }, 30_000);

    expect(oracle).toMatchObject({
      againstReplayId: probeId,
      againstState: 'finished',
      answered: originals.length,
      withAnswer: 1,
      roomToImprove: false,
    });

    const [replay] = await db
      .select()
      .from(schema.replay)
      .where(eq(schema.replay.id, started.replayId));
    const [candidate] = await db
      .select()
      .from(schema.replayCandidate)
      .where(eq(schema.replayCandidate.id, replay?.candidateId ?? ''));

    expect(candidate?.kind).toBe('oracle');
    expect(candidate?.station.model).toBe('sonnet');

    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: {
            iterations: 1,
            perIteration: 1,
            ceiling: { amount: 10, currency: 'USD' },
          },
        })
        .expect(200)
    ).body as { warnings: { kind: string }[] };

    expect(estimate.warnings.map((each) => each.kind)).toContain('no-headroom');
  }, 180_000);
});
