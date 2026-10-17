import { JudgingError } from '@outcomes/application/errors/judging.error';
import type { RunEvidence } from '@outcomes/application/ports/evidence.port';
import type { JudgeAsk } from '@outcomes/application/ports/judge.port';
import { WorkChangeJudgings } from '@outcomes/application/services/work-change-judgings.service';
import { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import type { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import { ChangeJudgingsInMemory } from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
import type { Verdict } from '@outcomes/domain/services/grounded-verdict';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
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
      kind: 'said',
      tool: null,
      text: 'Draining it in order.',
      given: null,
      returned: null,
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
  answer: (ask: JudgeAsk) => Promise<Verdict>,
  reference: string | null = 'original_1',
  available = true,
) => {
  const judgings = new ChangeJudgingsInMemory();
  await judgings.add(
    ChangeJudging.asked({
      runId: RunId.of('replay_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ rubric: RUBRIC }),
      reference: reference ? RunId.of(reference) : null,
      now: NOW,
    }),
  );
  judgings.events.length = 0;
  const asked: JudgeAsk[] = [];
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
      judge: async (ask) => {
        asked.push(ask);
        return {
          verdict: await answer(ask),
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

  await work.workDue();
  await work.idle();

  return {
    asked,
    judgings,
    judging: await judgings.of(RunId.of('replay_1'), 1),
  };
};

describe('WorkChangeJudgings', () => {
  it('judges a change claim by claim, saying which claims it met and the share met', async () => {
    const judgings = new ChangeJudgingsInMemory();
    await judgings.add(
      ChangeJudging.asked({
        runId: RunId.of('replay_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: JudgeCriteria.of({
          rubric: null,
          claims: ['It drains.', 'It keeps the order.'],
          passShare: 0.5,
        }),
        reference: null,
        now: NOW,
      }),
    );
    judgings.events.length = 0;
    const asked: JudgeAsk[] = [];
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
        judge: async (ask) => {
          asked.push(ask);
          return {
            verdict: {
              claims: ask.claims.map((_, index) => ({
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
            usage: null,
          };
        },
      },
      { now: () => NOW, sleep: async () => {} },
      inTransaction,
      logger,
      { report: () => undefined },
    );

    await work.workDue();
    await work.idle();

    const [event] = judgings.events as ChangeJudged[];
    expect(asked[0]).toMatchObject({
      scale: 'claims',
      rubric: null,
      claims: ['It drains.', 'It keeps the order.'],
    });
    expect(event?.value).toBe(0.5);
    expect(event?.marks).toEqual([true, false]);
    expect(event?.passShare).toBe(0.5);
    expect(event?.reasons.map((each) => each.claim)).toEqual([0, 1]);
  });

  it('judges the change against the rubric and the reference, citing only its own steps and hunks', async () => {
    const { asked, judgings } = await working(async () => ({
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

    expect(asked[0]?.scale).toBe('number');
    expect(asked[0]?.reference?.hunks).toEqual([
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

  it('judges on the rubric alone without a reference, and says so', async () => {
    const { asked, judgings } = await working(
      async () => ({
        value: 5,
        reasons: [{ text: 'It drains.', steps: [2], hunks: [] }],
      }),
      null,
    );

    expect(asked[0]?.reference).toBeNull();
    expect((judgings.events as ChangeJudged[])[0]?.referenced).toBe(false);
  });

  it('says it failed for good once it can try no more', async () => {
    const judgings = new ChangeJudgingsInMemory();
    const asked = ChangeJudging.asked({
      runId: RunId.of('replay_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: JudgeCriteria.of({ rubric: RUBRIC }),
      reference: null,
      now: NOW,
    });
    await judgings.add(asked);

    await judgings.save(asked.gaveUp(NOW));

    const [event] = judgings.events as ChangeJudgingFailed[];
    expect(event?.kind).toBe('change-judging.failed');
    expect(event?.failure.code).toBe('interrupted');
  });

  it('fails a judging for good once the judge is gone, rather than leaving it owed', async () => {
    const { asked, judging, judgings } = await working(
      async () => ({ value: 5, reasons: [] }),
      null,
      false,
    );

    expect(asked).toEqual([]);
    expect(judging?.owesWork).toBe(false);
    expect(judging?.failure?.code).toBe('unavailable');
    expect((judgings.events as ChangeJudgingFailed[])[0]?.failure.code).toBe(
      'unavailable',
    );
  });

  it('tries again later when the request to the provider fails', async () => {
    const { judging, judgings } = await working(async () => {
      throw new JudgingError('request-failed', 'no credits', null);
    });

    expect(judging?.owesWork).toBe(true);
    expect(judgings.events).toEqual([]);
  });

  it('keeps what an unreadable answer cost while it tries again later', async () => {
    const { judging } = await working(async () => {
      throw new JudgingError('unreadable', 'length', {
        inputTokens: 900,
        outputTokens: 4_000,
        cost: { amount: 0.04, currency: 'USD' },
      });
    });

    expect(judging?.owesWork).toBe(true);
    expect(judging?.spent).toMatchObject({
      calls: 1,
      costs: [{ amount: 0.04, currency: 'USD' }],
    });
  });
});
