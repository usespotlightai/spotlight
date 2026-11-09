import { JudgingError } from '@insights/application/errors/judging.error';
import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { JudgeRequest } from '@insights/application/ports/judge.port';
import { ChangeJudgments } from '@insights/application/services/change-judgments.service';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const RUBRIC = 'scores: 1-5\nDid it drain the queue without dropping a job?';

const evidenceOf = (runId: string, line: string): RunEvidence => ({
  runId: RunId.of(runId),
  taskId: TaskId.of('task_1'),
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

const judging = async (
  answer: (request: JudgeRequest) => Promise<Verdict>,
  options: {
    criteria?: JudgeCriteria;
    reference?: string | null;
    available?: boolean;
    guidance?: string | null;
    guidanceRequested?: boolean;
  } = {},
) => {
  const requests: JudgeRequest[] = [];
  const evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  };
  const judgments = new ChangeJudgments(
    {
      hasTask: async () => true,
      of: async (runId) => evidence[runId.value] ?? null,
    },
    {
      available: options.available ?? true,
      judge: async (request) => {
        requests.push(request);
        return {
          model: 'some/model',
          verdict: await answer(request),
          guidance: options.guidance ?? null,
          usage: {
            inputTokens: 900,
            outputTokens: 80,
            cost: { amount: 0.03, currency: 'USD' },
          },
        };
      },
    },
  );
  const reference =
    options.reference === undefined ? 'original_1' : options.reference;
  const judgment = await judgments.judge({
    runId: RunId.of('replay_1'),
    criteria: options.criteria ?? JudgeCriteria.of({ rubric: RUBRIC }),
    reference: reference ? RunId.of(reference) : null,
    guidanceRequested: options.guidanceRequested ?? true,
  });

  return { requests, judgment };
};

describe('ChangeJudgments', () => {
  it('judges a change claim by claim, saying which claims it met and the share met', async () => {
    const { requests, judgment } = await judging(
      async (request) => ({
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
      }),
      {
        criteria: JudgeCriteria.of({
          rubric: null,
          claims: ['It drains.', 'It keeps the order.'],
          passThreshold: 0.5,
        }),
        reference: null,
      },
    );

    expect(requests[0]).toMatchObject({
      scale: 'claims',
      rubric: null,
      claims: ['It drains.', 'It keeps the order.'],
    });
    expect(judgment).toMatchObject({
      judged: true,
      value: 0.5,
      claimResults: [true, false],
    });
    expect(
      judgment.judged && judgment.reasons.map((each) => each.claim),
    ).toEqual([0, 1]);
  });

  it('judges the change against the rubric and the reference, citing only its own steps and hunks', async () => {
    const { requests, judgment } = await judging(async () => ({
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
    expect(judgment).toMatchObject({
      judged: true,
      value: 4,
      referenced: true,
    });
    expect(judgment.spent.costs[0]?.amount).toBeCloseTo(0.03);
    expect(judgment.spent.inputTokens).toBe(900);
    expect(
      judgment.judged && judgment.reasons.map((each) => each.text),
    ).toEqual(['It drains.', 'It says how.']);
  });

  it('passes on what to improve only when asked, and only when it avoids the rubric', async () => {
    const failing = async () => ({
      value: 2,
      reasons: [{ text: 'It drops jobs.', steps: [2], hunks: [] }],
    });
    const kept = await judging(failing, {
      reference: null,
      guidance: 'Finish the jobs already taken before stopping the worker.',
    });
    const leaking = await judging(failing, {
      reference: null,
      guidance: 'Make it drain the queue without dropping a job.',
    });
    const unasked = await judging(failing, {
      reference: null,
      guidance: 'Finish the jobs already taken before stopping the worker.',
      guidanceRequested: false,
    });

    expect(kept.requests[0]?.guidanceRequested).toBe(true);
    expect(kept.requests[0]?.replayed).toBe(true);
    expect(kept.judgment.judged && kept.judgment.guidance).toBe(
      'Finish the jobs already taken before stopping the worker.',
    );
    expect(leaking.judgment.judged && leaking.judgment.guidance).toBeNull();
    expect(unasked.requests[0]?.guidanceRequested).toBe(false);
    expect(unasked.judgment.judged && unasked.judgment.guidance).toBeNull();
  });

  it('judges on the rubric alone without a reference, and says so', async () => {
    const { requests, judgment } = await judging(
      async () => ({
        value: 5,
        reasons: [{ text: 'It drains.', steps: [2], hunks: [] }],
      }),
      { reference: null },
    );

    expect(requests[0]?.reference).toBeNull();
    expect(judgment).toMatchObject({ judged: true, referenced: false });
  });

  it('asks no judge that is gone', async () => {
    const { requests, judgment } = await judging(
      async () => ({ value: 5, reasons: [] }),
      { available: false },
    );

    expect(requests).toEqual([]);
    expect(judgment).toMatchObject({ judged: false, failure: 'unavailable' });
  });

  it('says why a judgment failed, keeping what the answer cost', async () => {
    const failed = await judging(async () => {
      throw new JudgingError('request-failed', 'no credits', null);
    });
    const unreadable = await judging(async () => {
      throw new JudgingError('unreadable', 'length', {
        inputTokens: 900,
        outputTokens: 4_000,
        cost: { amount: 0.04, currency: 'USD' },
      });
    });
    const ungrounded = await judging(async () => ({
      value: 4,
      reasons: [{ text: 'It drains.', steps: [9], hunks: [] }],
    }));

    expect(failed.judgment).toMatchObject({
      judged: false,
      failure: 'request-failed',
    });
    expect(unreadable.judgment).toMatchObject({
      judged: false,
      failure: 'unreadable',
    });
    expect(unreadable.judgment.spent).toMatchObject({
      calls: 1,
      costs: [{ amount: 0.04, currency: 'USD' }],
    });
    expect(ungrounded.judgment).toMatchObject({
      judged: false,
      failure: 'ungrounded',
    });
    expect(ungrounded.judgment.spent.calls).toBe(1);
  });
});
