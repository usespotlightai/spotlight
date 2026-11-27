import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { PairJudgment } from '@insights/application/ports/pair-judgments.port';
import {
  SESSION_WAITING,
  type SessionFailed,
  type SessionWaiting,
} from '@insights/application/ports/session-outcomes';
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

const ROUND = {
  runId: RunId.of('replay_1'),
  otherRunId: RunId.of('replay_2'),
  attempt: 1,
};

const judging = async (
  answer: (
    request: SideBySideJudgeRequest,
  ) => PairVerdict | SessionFailed | SessionWaiting,
  evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drainFast()'),
    replay_2: evidenceOf('replay_2', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  },
) => {
  const requests: SideBySideJudgeRequest[] = [];
  const judgments = new PairJudgments(
    {
      hasTask: () => Promise.resolve(true),
      of: (runId) => Promise.resolve(evidence[runId.value] ?? null),
    },
    {
      judgePair: (request) => {
        requests.push(request);
        const verdict = answer(request);

        return Promise.resolve(
          'status' in verdict
            ? verdict
            : { status: 'judged', model: 'some/model', verdict },
        );
      },
      roundOf: () => ROUND,
    },
  );
  const judgment = await judgments.judge({
    workspaceId: 'workspace_1',
    round: ROUND,
    reference: RunId.of('original_1'),
    criteria: JudgeCriteria.of({
      claims: ['It drains.', 'It keeps the order.', 'It logs.'],
    }),
    orders: ORDERS,
  });

  return {
    requests,
    answered: judgment,
    get judgment() {
      return settled(judgment);
    },
  };
};

const fastSide = (request: SideBySideJudgeRequest): 'A' | 'B' =>
  request.a.hunks.some((each) => each.lines.includes('+drainFast()'))
    ? 'A'
    : 'B';

const settled = (answer: PairJudgment | SessionWaiting): PairJudgment => {
  if ('status' in answer) {
    throw new Error('expected a settled judgment');
  }

  return answer;
};

describe('PairJudgments', () => {
  it('shows the judge both changes labelled A and B beside the accepted one, in the orders asked, and names the winner by its run', async () => {
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
  });

  it('asks for one judging session per order, each a pass of the order’s round', async () => {
    const { requests } = await judging((request) => ({
      preferred: fastSide(request),
      reasons: [],
    }));

    expect(requests.map((each) => [each.round, each.pass])).toEqual([
      [ROUND, 'other-first'],
      [ROUND, 'run-first'],
    ]);
  });

  it('orders both sessions before it waits for the one still running', async () => {
    const asked: string[] = [];

    const { answered } = await judging((request) => {
      asked.push(request.pass);
      return request.pass === 'run-first'
        ? SESSION_WAITING
        : { preferred: fastSide(request), reasons: [] };
    });

    expect(answered).toEqual(SESSION_WAITING);
    expect(asked).toHaveLength(2);
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

  it('fails the way a failed pass session failed, once no pass waits', async () => {
    const { judgment } = await judging((request) => {
      if (request.pass === 'run-first') {
        return { status: 'failed', failure: 'request-failed' };
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

    expect(judgment).toMatchObject({
      judged: false,
      failure: 'request-failed',
    });
  });
});
