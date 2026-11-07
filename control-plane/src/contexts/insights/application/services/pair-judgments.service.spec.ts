import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { SideBySideJudgeRequest } from '@insights/application/ports/side-by-side-judge.port';
import { PairJudgments } from '@insights/application/services/pair-judgments.service';
import type { PairVerdict } from '@insights/domain/services/grounded-pair';
import type { PairOrder } from '@insights/domain/value-objects/pair-order';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const ORDERS: readonly PairOrder[] = ['other-first', 'run-first'];

const evidenceOf = (runId: string, line: string): RunEvidence => ({
  runId: RunId.of(runId),
  taskId: TaskId.of('task_1'),
  title: 'Drain the queue',
  description: null,
  steps: [],
  hunks: [
    {
      id: 'api/q.ts#1',
      path: 'api/q.ts',
      header: '@@ -1 +1 @@',
      lines: [line],
    },
  ],
});

const judging = async (
  answer: (request: SideBySideJudgeRequest) => PairVerdict,
  evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drainFast()'),
    replay_2: evidenceOf('replay_2', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  },
) => {
  const requests: SideBySideJudgeRequest[] = [];
  const judgments = new PairJudgments(
    {
      hasTask: async () => true,
      of: async (runId) => evidence[runId.value] ?? null,
    },
    {
      available: true,
      judgePair: async (request) => {
        requests.push(request);
        return {
          model: 'some/model',
          verdict: answer(request),
          usage: {
            inputTokens: 900,
            outputTokens: 80,
            cost: { amount: 0.02, currency: 'USD' },
          },
        };
      },
    },
  );
  const judgment = await judgments.judge({
    runId: RunId.of('replay_1'),
    otherRunId: RunId.of('replay_2'),
    reference: RunId.of('original_1'),
    criteria: JudgeCriteria.of({
      rubric: null,
      claims: ['It drains.', 'It keeps the order.', 'It logs.'],
    }),
    orders: ORDERS,
  });

  return { requests, judgment };
};

const fastSide = (request: SideBySideJudgeRequest): 'A' | 'B' =>
  request.a.hunks.some((each) => each.lines.includes('+drainFast()'))
    ? 'A'
    : 'B';

describe('PairJudgments', () => {
  it('shows the judge both changes labelled A and B beside the accepted one, in the orders asked, both calls counting, and names the winner by its run', async () => {
    const { requests, judgment } = await judging((request) => ({
      preferred: fastSide(request),
      reasons: [
        { text: 'It drains fast.', hunks: [`${fastSide(request)}:api/q.ts#1`] },
      ],
    }));

    expect(requests.map(fastSide)).toEqual(['B', 'A']);
    expect(requests[0]?.reference.hunks[0]?.lines).toEqual(['+drainInOrder()']);
    expect(requests[0]?.claims).toHaveLength(3);
    expect(judgment.judged && judgment.passes).toEqual([
      {
        order: 'other-first',
        winner: 'run',
        reasons: [
          { text: 'It drains fast.', runHunks: ['api/q.ts#1'], otherHunks: [] },
        ],
      },
      {
        order: 'run-first',
        winner: 'run',
        reasons: [
          { text: 'It drains fast.', runHunks: ['api/q.ts#1'], otherHunks: [] },
        ],
      },
    ]);
    expect(judgment.spent.costs).toEqual([{ amount: 0.04, currency: 'USD' }]);
  });

  it('fails with no accepted change to set beside them, asking nobody', async () => {
    const { requests, judgment } = await judging(
      () => ({ preferred: 'tie', reasons: [] }),
      {
        replay_1: evidenceOf('replay_1', '+drainFast()'),
        replay_2: evidenceOf('replay_2', '+drain()'),
      },
    );

    expect(requests).toEqual([]);
    expect(judgment).toMatchObject({ judged: false, failure: 'no-evidence' });
  });

  it('says a pass that rests on nothing shown, or gives no reason, after asking both ways', async () => {
    const { requests, judgment } = await judging(() => ({
      preferred: 'A',
      reasons: [{ text: 'It drains.', hunks: ['A:elsewhere.ts#9'] }],
    }));

    expect(requests).toHaveLength(2);
    expect(judgment).toMatchObject({ judged: false, failure: 'ungrounded' });
  });

  it('keeps what the first pass cost when the second call breaks', async () => {
    let calls = 0;
    const { judgment } = await judging((request) => {
      calls += 1;
      if (calls === 2) {
        throw new Error('the connection dropped');
      }
      return {
        preferred: fastSide(request),
        reasons: [
          {
            text: 'It drains fast.',
            hunks: [`${fastSide(request)}:api/q.ts#1`],
          },
        ],
      };
    });

    expect(judgment).toMatchObject({ judged: false, failure: 'errored' });
    expect(judgment.spent.costs).toEqual([{ amount: 0.02, currency: 'USD' }]);
  });
});
