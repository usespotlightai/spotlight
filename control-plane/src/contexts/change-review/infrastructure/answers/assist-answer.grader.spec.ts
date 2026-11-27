import type {
  AssistOrder,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import type { GradingRequest } from '@change-review/application/ports/answer-grader.port';
import { SESSION_WAITING } from '@change-review/application/ports/session-waiting';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import {
  ANSWER_FILE,
  AssistAnswerGrader,
  answerFileOf,
  BRIEFING,
  GRADE_RESULT,
} from '@change-review/infrastructure/answers/assist-answer.grader';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const REQUEST: GradingRequest = {
  workspaceId: 'workspace-1',
  round: GradingRound.of({
    answerId: QuestionAnswerId.of('answer-1'),
    answeredAt: new Date(1_793_613_600_000),
    attempt: 1,
  }),
  basedOnRun: RunId.of('run-1'),
  question: 'Who signs a message when the member has left?',
  expected: 'The integration signs it.',
  reply: 'The bot signs it.',
  cited: [
    { path: 'slack.ts', patch: '@@ -1 +1 @@\n-bot\n+member ?? integration' },
  ],
};

const grading = (state: AssistState) => {
  const orders: AssistOrder[] = [];

  return {
    orders,
    grader: new AssistAnswerGrader({
      request: (order) => {
        orders.push(order);
        return Promise.resolve(state);
      },
    }),
  };
};

describe('AssistAnswerGrader', () => {
  it('orders a grade session with the question, the expected answer, the cited hunks and the reply', async () => {
    const { orders, grader } = grading({
      status: 'waiting',
      since: new Date(0),
    });

    await expect(grader.grade(REQUEST)).resolves.toEqual(SESSION_WAITING);

    const [order] = optionalItems(orders);
    expect(order).toMatchObject({
      workspaceId: 'workspace-1',
      purpose: 'change-review.grade',
      key: 'answer-1:1793613600000:1',
      basedOnRun: 'run-1',
      briefing: BRIEFING,
    });
    expect(order?.files[ANSWER_FILE]).toBe(
      [
        '# Question\n\nWho signs a message when the member has left?',
        '# Expected answer\n\nThe integration signs it.',
        '# Hunks that show the answer\n\n## slack.ts\n@@ -1 +1 @@\n-bot\n+member ?? integration',
        "# The reviewer's answer\n\nThe bot signs it.\n",
      ].join('\n\n'),
    );
  });

  it('briefs the session to grade by meaning and to submit its grade', () => {
    expect(BRIEFING).toContain(`.spotlight/assist/${ANSWER_FILE}`);
    expect(BRIEFING).toContain('Judge meaning, not wording');
    expect(BRIEFING).toContain('`spotlight submit <file>`');
    expect(BRIEFING).toContain('fix them and submit again');
    expect(BRIEFING).not.toContain('—');
  });

  it('cuts the cited hunks to what a grade needs', () => {
    const long = answerFileOf({
      ...REQUEST,
      cited: [
        { path: 'a.ts', patch: 'x'.repeat(30_000) },
        { path: 'b.ts', patch: 'never shown' },
      ],
    });

    expect(long).toContain('## a.ts');
    expect(long).toContain('…');
    expect(long).not.toContain('b.ts');
  });

  it('takes the grade and the usage the session submitted', async () => {
    const usage = { inputTokens: 300, outputTokens: 40, cost: null };
    const { grader } = grading({
      status: 'submitted',
      result: { verdict: 'partly-right', feedback: 'Not the bot.' },
      usage,
      model: 'claude-code',
    });

    expect(await grader.grade(REQUEST)).toEqual({
      status: 'graded',
      grade: { verdict: 'partly-right', feedback: 'Not the bot.' },
      usage,
    });
  });

  it('reports a session that failed, and one whose result is not a grade', async () => {
    expect(
      await grading({ status: 'failed', reason: 'run-failed' }).grader.grade(
        REQUEST,
      ),
    ).toEqual({ status: 'failed', failure: SessionFailure.of('run-failed') });
    expect(
      await grading({
        status: 'submitted',
        result: { verdict: 'mostly' },
        usage: null,
        model: 'claude-code',
      }).grader.grade(REQUEST),
    ).toEqual({ status: 'failed', failure: SessionFailure.of('no-result') });
  });

  it('refuses a grade at submission with the field that is wrong', () => {
    const parsed = GRADE_RESULT.schema.safeParse({ verdict: 'mostly' });

    expect(parsed.error?.issues.map((each) => each.path)).toEqual([
      ['verdict'],
      ['feedback'],
    ]);
  });
});
