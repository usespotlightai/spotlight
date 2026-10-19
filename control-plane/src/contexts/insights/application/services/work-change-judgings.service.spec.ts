import { JudgingError } from '@insights/application/errors/judging.error';
import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { JudgeRequest } from '@insights/application/ports/judge.port';
import { WorkChangeJudgings } from '@insights/application/services/work-change-judgings.service';
import { ChangeJudging } from '@insights/domain/aggregates/change-judging.aggregate';
import type { ChangeJudged } from '@insights/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@insights/domain/events/change-judging-failed.event';
import { ChangeJudgingsInMemory } from '@insights/domain/judging.fake-spec';
import { inTransaction } from '@insights/domain/runs.fake-spec';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:05:00.000Z');

const RUBRIC = 'scores: 1-5\nDid it drain the queue without dropping a job?';

const evidenceOf = (runId: string, line: string): RunEvidence => ({
  runId,
  taskId: 'task_1',
  title: 'Drain the queue',
  description: 'It stalls on restart.',
  steps: [
    {
      index: 2,
      kind: 'message',
      tool: null,
      text: 'Draining it in order.',
      input: null,
      output: null,
    },
  ],
  hunks: [
    {
      id: 'api/src/queue.ts#1',
      path: 'api/src/queue.ts',
      header: '@@ -1 +1 @@',
      lines: ['-stall()', line],
    },
  ],
});

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const working = async (
  answer: (request: JudgeRequest) => Promise<Verdict>,
  reference: string | null = 'original_1',
  available = true,
  guidance: string | null = null,
) => {
  const judgings = new ChangeJudgingsInMemory();
  await judgings.add(
    ChangeJudging.requested({
      runId: RunId.of('replay_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ rubric: RUBRIC }),
      reference: reference ? RunId.of(reference) : null,
      now: NOW,
    }),
  );
  judgings.events.length = 0;
  const requests: JudgeRequest[] = [];
  const evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  };
  const work = new WorkChangeJudgings(
    judgings,
    {
      hasTask: async () => true,
      of: async (runId) => evidence[runId] ?? null,
      judgesOnTeam: async () => new Map(),
      judgeAt: async () => null,
    },
    {
      available,
      model: 'some/model',
      judge: async (request) => {
        requests.push(request);
        return {
          verdict: await answer(request),
          guidance,
          usage: {
            inputTokens: 900,
            outputTokens: 80,
            cost: { amount: 0.03, currency: 'USD' },
          },
        };
      },
    },
    { now: () => NOW, sleep: async () => {} },
    inTransaction,
    logger,
    { report: () => undefined },
  );

  await work.processDue();
  await work.idle();

  return {
    requests,
    judgings,
    judging: await judgings.of(RunId.of('replay_1'), 1),
  };
};

describe('WorkChangeJudgings', () => {
  it('judges a change claim by claim, saying which claims it met and the share met', async () => {
    const judgings = new ChangeJudgingsInMemory();
    await judgings.add(
      ChangeJudging.requested({
        runId: RunId.of('replay_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: JudgeCriteria.of({
          rubric: null,
          claims: ['It drains.', 'It keeps the order.'],
          passThreshold: 0.5,
        }),
        reference: null,
        now: NOW,
      }),
    );
    judgings.events.length = 0;
    const requests: JudgeRequest[] = [];
    const work = new WorkChangeJudgings(
      judgings,
      {
        hasTask: async () => true,
        of: async (runId) => evidenceOf(runId, '+drain()'),
        judgesOnTeam: async () => new Map(),
        judgeAt: async () => null,
      },
      {
        available: true,
        model: 'some/model',
        judge: async (request) => {
          requests.push(request);
          return {
            verdict: {
              claims: request.claims.map((_, index) => ({
                index,
                met: index === 0,
                reasons: [
                  {
                    text: `Claim ${index}.`,
                    steps: [2],
                    hunks: ['api/src/queue.ts#1'],
                  },
                ],
              })),
            },
            guidance: null,
            usage: null,
          };
        },
      },
      { now: () => NOW, sleep: async () => {} },
      inTransaction,
      logger,
      { report: () => undefined },
    );

    await work.processDue();
    await work.idle();

    const [event] = judgings.events as ChangeJudged[];
    expect(requests[0]).toMatchObject({
      scale: 'claims',
      rubric: null,
      claims: ['It drains.', 'It keeps the order.'],
    });
    expect(event?.value).toBe(0.5);
    expect(event?.claimResults).toEqual([true, false]);
    expect(event?.passThreshold).toBe(0.5);
    expect(event?.reasons.map((each) => each.claim)).toEqual([0, 1]);
  });

  it('judges the change against the rubric and the reference, citing only its own steps and hunks', async () => {
    const { requests, judgings } = await working(async () => ({
      value: 4,
      reasons: [
        { text: 'It drains.', steps: [2], hunks: ['api/src/queue.ts#1'] },
        { text: 'It says how.', steps: [2], hunks: [] },
        {
          text: 'The accepted change kept the order.',
          steps: [],
          hunks: ['reference:api/src/queue.ts#1'],
        },
      ],
    }));

    expect(requests[0]?.scale).toBe('number');
    expect(requests[0]?.reference?.hunks).toEqual([
      {
        id: 'reference:api/src/queue.ts#1',
        path: 'api/src/queue.ts',
        header: '@@ -1 +1 @@',
        lines: ['-stall()', '+drainInOrder()'],
      },
    ]);
    const [event] = judgings.events as ChangeJudged[];
    expect(event?.kind).toBe('change-judging.judged');
    expect(event?.value).toBe(4);
    expect(event?.referenced).toBe(true);
    expect(event?.spent.costs[0]?.amount).toBeCloseTo(0.03);
    expect(event?.spent.inputTokens).toBe(900);
    expect(event?.reasons.map((each) => each.text)).toEqual([
      'It drains.',
      'It says how.',
    ]);
  });

  it('requests what the run should do differently, and passes on an guidance that avoids the rubric', async () => {
    const failing = async () => ({
      value: 2,
      reasons: [{ text: 'It drops jobs.', steps: [2], hunks: [] }],
    });
    const { requests, judgings } = await working(
      failing,
      null,
      true,
      'Finish the jobs already taken before stopping the worker.',
    );
    const leaking = await working(
      failing,
      null,
      true,
      'Make it drain the queue without dropping a job.',
    );

    expect(requests[0]?.guidanceRequested).toBe(true);
    expect((judgings.events as ChangeJudged[])[0]?.guidance).toBe(
      'Finish the jobs already taken before stopping the worker.',
    );
    expect((leaking.judgings.events as ChangeJudged[])[0]?.guidance).toBeNull();
  });

  it('judges on the rubric alone without a reference, and says so', async () => {
    const { requests, judgings } = await working(
      async () => ({
        value: 5,
        reasons: [{ text: 'It drains.', steps: [2], hunks: [] }],
      }),
      null,
    );

    expect(requests[0]?.reference).toBeNull();
    expect((judgings.events as ChangeJudged[])[0]?.referenced).toBe(false);
  });

  it('says it failed for good once it can try no more', async () => {
    const judgings = new ChangeJudgingsInMemory();
    const requested = ChangeJudging.requested({
      runId: RunId.of('replay_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ rubric: RUBRIC }),
      reference: null,
      now: NOW,
    });
    await judgings.add(requested);

    await judgings.save(requested.deadLetter(NOW));

    const [event] = judgings.events as ChangeJudgingFailed[];
    expect(event?.kind).toBe('change-judging.failed');
    expect(event?.failure.code).toBe('interrupted');
  });

  it('fails a judging for good once the judge is gone, rather than leaving it pending', async () => {
    const { requests, judging, judgings } = await working(
      async () => ({ value: 5, reasons: [] }),
      null,
      false,
    );

    expect(requests).toEqual([]);
    expect(judging?.hasPendingJob).toBe(false);
    expect(judging?.failure?.code).toBe('unavailable');
    expect((judgings.events as ChangeJudgingFailed[])[0]?.failure.code).toBe(
      'unavailable',
    );
  });

  it('retries later when the request to the provider fails', async () => {
    const { judging, judgings } = await working(async () => {
      throw new JudgingError('request-failed', 'no credits', null);
    });

    expect(judging?.hasPendingJob).toBe(true);
    expect(judgings.events).toEqual([]);
  });

  it('keeps what an unreadable answer cost while it retries later', async () => {
    const { judging } = await working(async () => {
      throw new JudgingError('unreadable', 'length', {
        inputTokens: 900,
        outputTokens: 4_000,
        cost: { amount: 0.04, currency: 'USD' },
      });
    });

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.spent).toMatchObject({
      calls: 1,
      costs: [{ amount: 0.04, currency: 'USD' }],
    });
  });
});
