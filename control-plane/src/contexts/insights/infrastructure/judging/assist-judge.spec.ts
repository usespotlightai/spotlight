import type { JudgeRequest } from '@insights/application/ports/judge.port';
import { SESSION_WAITING } from '@insights/application/ports/session-outcomes';
import { MAX_REASONS_PER_CLAIM } from '@insights/domain/services/grounded-verdict';
import { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import {
  AssistJudge,
  JUDGE_RESULT,
} from '@insights/infrastructure/judging/assist-judge';
import {
  FakeAssistSessions,
  submitted,
} from '@insights/infrastructure/judging/assist-sessions.fake-spec';
import { RUBRIC_VERSION } from '@insights/judging.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const REQUEST: JudgeRequest = {
  workspaceId: 'workspace_1',
  round: {
    of: 'judging',
    round: JudgingRound.of({
      runId: RunId.of('run_1'),
      rubricVersion: RUBRIC_VERSION,
      attempt: 1,
    }),
  },
  claims: ['It retries the upload without a queue.'],
  title: 'Retry uploads',
  description: 'They fail on a flaky network.',
  steps: [
    {
      index: 7,
      kind: 'tool',
      tool: 'execute',
      text: 'npm test',
      input: 'npm test',
      output: '12 passing',
    },
  ],
  stepsLeftOut: 0,
  hunks: [
    {
      id: 'api/src/uploads.ts#1',
      path: 'api/src/uploads.ts',
      header: '@@ -1 +1 @@',
      lines: ['-upload()', '+retry(upload)'],
    },
  ],
  hunksLeftOut: 2,
  reference: null,
  guidanceRequested: false,
  effectsBlocked: false,
};

const REASONS = [{ text: 'It retries in the request.', steps: [7], hunks: [] }];

const VERDICT = { claims: [{ index: 0, met: true, reasons: REASONS }] };

const judging = async (
  sessions: FakeAssistSessions,
  request: JudgeRequest = REQUEST,
) => new AssistJudge(sessions).judge(request);

describe('judging a run in an assist session', () => {
  it('orders a judge session on the run with the claims in its briefing and the evidence as a file', async () => {
    const sessions = new FakeAssistSessions(submitted(VERDICT));

    await judging(sessions);

    const [order] = sessions.orders;
    expect(order).toMatchObject({
      workspaceId: 'workspace_1',
      purpose: 'insights.judge',
      key: `judging:run_1:${RUBRIC_VERSION}:1`,
      basedOnRun: 'run_1',
    });
    expect(order?.briefing).toContain(
      '0. It retries the upload without a queue.',
    );
    expect(order?.briefing).toContain('.spotlight/assist/evidence.json');
    expect(order?.briefing).toContain('spotlight submit');
    expect(order?.briefing).toContain('Do not change, commit or push any file');
    expect(order?.briefing).not.toContain('—');
    expect(order?.briefing).not.toContain('"guidance"');
    expect(JSON.parse(order?.files['evidence.json'] ?? '')).toEqual({
      task: {
        title: 'Retry uploads',
        description: 'They fail on a flaky network.',
      },
      steps: [
        {
          index: 7,
          kind: 'tool',
          tool: 'execute',
          text: 'npm test',
          input: 'npm test',
          output: '12 passing',
        },
      ],
      hunks: [
        {
          id: 'api/src/uploads.ts#1',
          path: 'api/src/uploads.ts',
          header: '@@ -1 +1 @@',
          lines: ['-upload()', '+retry(upload)'],
        },
      ],
      left_out: { steps: 0, hunks: 2 },
    });
  });

  it('reads the verdict the session submitted, with guidance only when asked for', async () => {
    const answer = submitted({ ...VERDICT, guidance: 'Retry in place.' });

    const plain = await judging(new FakeAssistSessions(answer));
    const guided = await judging(new FakeAssistSessions(answer), {
      ...REQUEST,
      guidanceRequested: true,
    });

    expect(plain).toEqual({
      status: 'judged',
      verdict: VERDICT,
      guidance: null,
      model: 'claude-code/claude-sonnet-4-5',
    });
    expect(guided).toMatchObject({ guidance: 'Retry in place.' });
  });

  it('asks for guidance, the reference and blocked effects in the briefing only when the request has them', async () => {
    const sessions = new FakeAssistSessions(submitted(VERDICT));

    await judging(sessions, {
      ...REQUEST,
      guidanceRequested: true,
      effectsBlocked: true,
      reference: { hunks: REQUEST.hunks, hunksLeftOut: 0 },
    });

    const [order] = sessions.orders;
    expect(order?.briefing).toContain('Answer "guidance"');
    expect(order?.briefing).toContain('blocked every effect outside it');
    expect(order?.briefing).toContain('never a hunk of the reference');
    expect(JSON.parse(order?.files['evidence.json'] ?? '')).toMatchObject({
      reference: { left_out: { hunks: 0 } },
    });
  });

  it('waits while the session has not submitted', async () => {
    await expect(judging(new FakeAssistSessions())).resolves.toEqual(
      SESSION_WAITING,
    );
  });

  it('names the model the session ran on', async () => {
    await expect(
      judging(new FakeAssistSessions(submitted(VERDICT, 'codex/gpt-5'))),
    ).resolves.toMatchObject({ model: 'codex/gpt-5' });
  });

  it.each([
    ['no-harness', 'unavailable'],
    ['base-run-elsewhere', 'unavailable'],
    ['run-failed', 'request-failed'],
    ['no-result', 'unreadable'],
  ] as const)(
    'answers a session that failed with %s as failed: %s',
    async (reason, failure) => {
      await expect(
        judging(new FakeAssistSessions({ status: 'failed', reason })),
      ).resolves.toEqual({ status: 'failed', failure });
    },
  );

  it('calls a result that does not fit the verdict unreadable', async () => {
    await expect(
      judging(new FakeAssistSessions(submitted({ verdict: 'pass' }))),
    ).resolves.toEqual({ status: 'failed', failure: 'unreadable' });
  });

  it('reads each session of its own, and reads back the round of a settled one', async () => {
    const sessions = new FakeAssistSessions();
    const judge = new AssistJudge(sessions);
    const retried: JudgeRequest = {
      ...REQUEST,
      round: {
        of: 'judging',
        round: JudgingRound.of({
          runId: RunId.of('run_1'),
          rubricVersion: RUBRIC_VERSION,
          attempt: 2,
        }),
      },
    };
    await judge.judge(REQUEST);
    const [first] = sessions.orders;
    sessions.settle(
      { purpose: 'insights.judge', key: first?.key ?? '' },
      submitted(VERDICT),
    );

    await expect(judge.judge(retried)).resolves.toEqual(SESSION_WAITING);
    await expect(judge.judge(REQUEST)).resolves.toMatchObject({
      status: 'judged',
    });
    expect(sessions.orders).toHaveLength(2);
    expect(
      judge.roundOf({
        workspaceId: 'workspace_1',
        purpose: 'insights.judge',
        key: first?.key ?? '',
      }),
    ).toEqual(REQUEST.round);
  });

  it('takes a result only with at most a few reasons per claim', () => {
    const reasons = Array.from(
      { length: MAX_REASONS_PER_CLAIM + 1 },
      () => REASONS[0],
    );

    expect(
      JUDGE_RESULT.schema.safeParse({
        claims: [{ index: 0, met: true, reasons }],
      }).success,
    ).toBe(false);
    expect(JUDGE_RESULT.schema.safeParse(VERDICT).success).toBe(true);
  });
});
