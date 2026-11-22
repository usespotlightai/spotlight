import { SESSION_WAITING } from '@insights/application/ports/session-outcomes';
import type { SideBySideJudgeRequest } from '@insights/application/ports/side-by-side-judge.port';
import { MAX_REASONS } from '@insights/domain/services/grounded-verdict';
import {
  FakeAssistSessions,
  submitted,
} from '@insights/infrastructure/judging/assist-sessions.fake-spec';
import {
  AssistSideBySideJudge,
  PAIR_RESULT,
} from '@insights/infrastructure/judging/assist-side-by-side-judge';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, line: string) => ({
  id,
  path: 'api/q.ts',
  header: '@@ -1 +1 @@',
  lines: [line],
});

const REQUEST: SideBySideJudgeRequest = {
  workspaceId: 'workspace_1',
  round: {
    runId: RunId.of('replay_1'),
    otherRunId: RunId.of('replay_2'),
    attempt: 1,
  },
  pass: 'run-first',
  claims: ['It drains.'],
  title: 'Drain the queue',
  description: null,
  a: { hunks: [hunk('A:api/q.ts#1', '+drainFast()')], hunksLeftOut: 0 },
  b: { hunks: [hunk('B:api/q.ts#1', '+drain()')], hunksLeftOut: 1 },
  reference: {
    hunks: [hunk('reference:api/q.ts#1', '+drainInOrder()')],
    hunksLeftOut: 0,
  },
};

const VERDICT = {
  preferred: 'A',
  reasons: [{ text: 'It drains fast.', hunks: ['A:api/q.ts#1'] }],
};

const judging = (sessions: FakeAssistSessions) =>
  new AssistSideBySideJudge(sessions).judgePair(REQUEST);

describe('judging two changes side by side in an assist session', () => {
  it('orders a pair-judge session with the claims in its briefing and both changes and the reference as a file', async () => {
    const sessions = new FakeAssistSessions(submitted(VERDICT));

    const answer = await judging(sessions);

    const [order] = sessions.orders;
    expect(order).toMatchObject({
      purpose: 'insights.pair-judge',
      key: 'pair-judging:replay_1:replay_2:1:run-first',
      basedOnRun: 'replay_1',
    });
    expect(order?.briefing).toContain('0. It drains.');
    expect(order?.briefing).toContain('.spotlight/assist/evidence.json');
    expect(order?.briefing).toContain('spotlight submit');
    expect(order?.briefing).not.toContain('—');
    expect(JSON.parse(order?.files['evidence.json'] ?? '')).toMatchObject({
      a: { hunks: [{ lines: ['+drainFast()'] }] },
      b: { left_out: 1 },
      reference: { hunks: [{ id: 'reference:api/q.ts#1' }] },
    });
    expect(answer).toEqual({
      status: 'judged',
      verdict: VERDICT,
      model: 'claude-code/claude-sonnet-4-5',
    });
    expect(
      new AssistSideBySideJudge(sessions).roundOf({
        workspaceId: 'workspace_1',
        purpose: order?.purpose ?? '',
        key: order?.key ?? '',
      }),
    ).toEqual(REQUEST.round);
  });

  it('waits while the session has not submitted', async () => {
    await expect(judging(new FakeAssistSessions())).resolves.toEqual(
      SESSION_WAITING,
    );
  });

  it('names a failed session as a failed request', async () => {
    await expect(
      judging(
        new FakeAssistSessions({ status: 'failed', reason: 'run-failed' }),
      ),
    ).resolves.toEqual({ status: 'failed', failure: 'request-failed' });
  });

  it('takes a result only with a side or a tie and a few reasons', () => {
    const reasons = Array.from(
      { length: MAX_REASONS + 1 },
      () => VERDICT.reasons[0],
    );

    expect(PAIR_RESULT.schema.safeParse(VERDICT).success).toBe(true);
    expect(
      PAIR_RESULT.schema.safeParse({ ...VERDICT, preferred: 'C' }).success,
    ).toBe(false);
    expect(PAIR_RESULT.schema.safeParse({ ...VERDICT, reasons }).success).toBe(
      false,
    );
  });
});
