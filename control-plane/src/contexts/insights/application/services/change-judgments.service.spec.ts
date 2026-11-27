import type { ChangeJudgment } from '@insights/application/ports/change-judgments.port';
import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { JudgeRequest } from '@insights/application/ports/judge.port';
import {
  SESSION_WAITING,
  type SessionFailed,
  type SessionWaiting,
} from '@insights/application/ports/session-outcomes';
import { ChangeJudgments } from '@insights/application/services/change-judgments.service';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const CRITERIA = JudgeCriteria.of({
  claims: ['It drains the queue without dropping a job.'],
});

const oneClaim = (
  met: boolean,
  reasons: { text: string; steps: number[]; hunks: string[] }[],
): Verdict => ({ claims: [{ index: 0, met, reasons }] });

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

const ROUND = { runId: RunId.of('replay_1'), judging: 1, attempt: 1 };

const judging = async (
  answer: (
    request: JudgeRequest,
  ) => Promise<Verdict | SessionFailed | SessionWaiting>,
  options: {
    criteria?: JudgeCriteria;
    reference?: string | null;
    guidance?: string | null;
    guidanceRequested?: boolean;
    effectsBlocked?: boolean;
  } = {},
) => {
  const requests: JudgeRequest[] = [];
  const evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  };
  const judgments = new ChangeJudgments(
    {
      hasTask: () => Promise.resolve(true),
      of: (runId) => Promise.resolve(evidence[runId.value] ?? null),
    },
    {
      judge: async (request) => {
        requests.push(request);
        const verdict = await answer(request);

        return 'status' in verdict
          ? verdict
          : {
              status: 'judged',
              model: 'some/model',
              verdict,
              guidance: options.guidance ?? null,
            };
      },
      roundOf: (session) =>
        session.key === 'mine'
          ? { of: 'change', round: ROUND }
          : { of: 'judging', round: partial<JudgingRound>({}) },
    },
  );
  const reference =
    options.reference === undefined ? 'original_1' : options.reference;
  const answered = await judgments.judge({
    workspaceId: 'workspace_1',
    round: ROUND,
    criteria: options.criteria ?? CRITERIA,
    reference:
      reference !== null && reference !== '' ? RunId.of(reference) : null,
    guidanceRequested: options.guidanceRequested ?? true,
    effectsBlocked: options.effectsBlocked ?? true,
  });

  return {
    requests,
    answered,
    get judgment() {
      return settled(answered);
    },
    judgments,
  };
};

const settled = (answer: ChangeJudgment | SessionWaiting): ChangeJudgment => {
  if ('status' in answer) {
    throw new Error('expected a settled judgment');
  }

  return answer;
};

describe('ChangeJudgments', () => {
  it('judges a change claim by claim, saying which claims it met', async () => {
    const { requests, judgment } = await judging(
      (request) =>
        Promise.resolve({
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
          claims: ['It drains.', 'It keeps the order.'],
          passThreshold: 0.5,
        }),
        reference: null,
      },
    );

    expect(requests[0]).toMatchObject({
      claims: ['It drains.', 'It keeps the order.'],
    });
    expect(judgment).toMatchObject({
      judged: true,
      claimResults: [true, false],
    });
    expect(
      judgment.judged && judgment.reasons.map((each) => each.claim),
    ).toEqual([0, 1]);
  });

  it('judges the change against the claims and the reference, citing only its own steps and hunks', async () => {
    const { requests, judgment } = await judging(() =>
      Promise.resolve(
        oneClaim(true, [
          { text: 'It drains.', steps: [2], hunks: ['api/src/queue.ts#1'] },
          { text: 'It says how.', steps: [2], hunks: [] },
          {
            text: 'The accepted change kept the order.',
            steps: [],
            hunks: ['reference:api/src/queue.ts#1'],
          },
        ]),
      ),
    );

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
      claimResults: [true],
      referenced: true,
    });
    expect(
      judgment.judged && judgment.reasons.map((each) => each.text),
    ).toEqual(['It drains.', 'It says how.']);
  });

  it('passes on what to improve only when asked, and only when it avoids the claims', async () => {
    const failing = () =>
      Promise.resolve(
        oneClaim(false, [{ text: 'It drops jobs.', steps: [2], hunks: [] }]),
      );
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
    expect(kept.judgment.judged && kept.judgment.guidance).toBe(
      'Finish the jobs already taken before stopping the worker.',
    );
    expect(leaking.judgment.judged && leaking.judgment.guidance).toBeNull();
    expect(unasked.requests[0]?.guidanceRequested).toBe(false);
    expect(unasked.judgment.judged && unasked.judgment.guidance).toBeNull();
  });

  it('tells the judge whether the run had its effects blocked, as the order says', async () => {
    const passing = () =>
      Promise.resolve(
        oneClaim(true, [{ text: 'It drains.', steps: [2], hunks: [] }]),
      );
    const blocked = await judging(passing, { effectsBlocked: true });
    const open = await judging(passing, { effectsBlocked: false });

    expect(blocked.requests[0]?.effectsBlocked).toBe(true);
    expect(open.requests[0]?.effectsBlocked).toBe(false);
  });

  it('judges on the claims alone without a reference, and says so', async () => {
    const { requests, judgment } = await judging(
      () =>
        Promise.resolve(
          oneClaim(true, [{ text: 'It drains.', steps: [2], hunks: [] }]),
        ),
      { reference: null },
    );

    expect(requests[0]?.reference).toBeNull();
    expect(judgment).toMatchObject({ judged: true, referenced: false });
  });

  it('asks for the judging session of the order’s round', async () => {
    const { requests } = await judging(() =>
      Promise.resolve(
        oneClaim(true, [{ text: 'It drains.', steps: [2], hunks: [] }]),
      ),
    );

    expect(requests[0]?.round).toEqual({ of: 'change', round: ROUND });
  });

  it('reads back only the rounds it judged for an asker', async () => {
    const { judgments } = await judging(() => Promise.resolve(SESSION_WAITING));
    const session = { workspaceId: 'workspace_1', purpose: 'insights.judge' };

    expect(judgments.roundOf({ ...session, key: 'mine' })).toEqual(ROUND);
    expect(judgments.roundOf({ ...session, key: 'theirs' })).toBeNull();
  });

  it('answers waiting while the judging session runs, so the job waits', async () => {
    const { answered } = await judging(() => Promise.resolve(SESSION_WAITING));

    expect(answered).toEqual(SESSION_WAITING);
  });

  it('says the judge is unavailable when there is no harness to judge on', async () => {
    const { judgment } = await judging(() =>
      Promise.resolve({
        status: 'failed',
        failure: 'unavailable',
      }),
    );

    expect(judgment).toMatchObject({ judged: false, failure: 'unavailable' });
  });

  it('says why a judgment failed', async () => {
    const failed = await judging(() =>
      Promise.resolve({
        status: 'failed',
        failure: 'request-failed',
      }),
    );
    const unreadable = await judging(() =>
      Promise.resolve({
        status: 'failed',
        failure: 'unreadable',
      }),
    );
    const ungrounded = await judging(() =>
      Promise.resolve(
        oneClaim(true, [{ text: 'It drains.', steps: [9], hunks: [] }]),
      ),
    );

    expect(failed.judgment).toMatchObject({
      judged: false,
      failure: 'request-failed',
    });
    expect(unreadable.judgment).toMatchObject({
      judged: false,
      failure: 'unreadable',
    });
    expect(ungrounded.judgment).toMatchObject({
      judged: false,
      failure: 'ungrounded',
    });
  });
});
