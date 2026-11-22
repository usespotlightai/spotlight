import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { InvalidAnswerError } from '@change-review/domain/exceptions/invalid-answer.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import type { LayerQuestion } from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const QUESTION: LayerQuestion = {
  id: QuestionId.of('c1.l2.q1'),
  question: 'Who signs a message when the member has left?',
  answer: 'The integration signs it.',
  hunks: [HunkId.of('h4')],
};

const NOW = new Date('2026-11-02T10:00:00Z');

const LATER = new Date('2026-11-02T10:01:00Z');

const given = (reply: string | null) =>
  QuestionAnswer.given({
    id: QuestionAnswerId.of('answer-1'),
    stack: {
      id: ChangeStackId.of('stack-1'),
      workspaceId: WorkspaceId.of('workspace-1'),
      taskId: TaskId.of('task-1'),
      teamId: null,
      repository: null,
    },
    question: QUESTION,
    personId: UserId.of('user-1'),
    reply,
    now: NOW,
  });

describe('QuestionAnswer', () => {
  it('waits for the grade of an answer in words, and keeps what it is graded against', () => {
    const answer = given(' The bot signs it. ');

    expect(answer.reply).toBe('The bot signs it.');
    expect(answer.grading).toBe('pending');
    expect(answer.verdict).toBeNull();
    expect(answer.feedback).toBeNull();
    expect(answer.hasPendingJob).toBe(true);
    expect(answer.asked).toBe(QUESTION.question);
    expect(answer.expected).toBe('The integration signs it.');
  });

  it('takes the grade its session gives, with the session’s usage', () => {
    const graded = given('The bot signs it.')
      .leaseJob(NOW)
      .graded({
        grade: {
          verdict: 'partly-right',
          feedback: ' The integration signs. ',
        },
        usage: { inputTokens: 300, outputTokens: 40, cost: null },
      });

    expect(graded.grading).toBe('graded');
    expect(graded.verdict).toBe('partly-right');
    expect(graded.feedback).toBe('The integration signs.');
    expect(graded.usage.calls).toBe(1);
    expect(graded.hasPendingJob).toBe(false);
    expect(() =>
      graded.graded({
        grade: { verdict: 'right', feedback: '' },
        usage: null,
      }),
    ).toThrow(InvalidAnswerError);
  });

  it('keeps at most the feedback it has room for', () => {
    const answer = given('The bot.').graded({
      grade: { verdict: 'missed', feedback: 'x'.repeat(2_500) },
      usage: null,
    });

    expect(answer.feedback).toHaveLength(2_000);
  });

  it('counts “I don’t know” as missed at once, with nothing to grade', () => {
    for (const reply of [null, '   ']) {
      const answer = given(reply);

      expect(answer.reply).toBeNull();
      expect(answer.grading).toBe('graded');
      expect(answer.verdict).toBe('missed');
      expect(answer.feedback).toBeNull();
      expect(answer.hasPendingJob).toBe(false);
      expect(answer.usage.calls).toBe(0);
    }
  });

  it('refuses a reply too long', () => {
    expect(() => given('x'.repeat(4_001))).toThrow(
      'An answer must be at most 4000 characters.',
    );
  });

  it('waits for its grading session without spending an attempt', () => {
    const at = new Date(LATER.getTime() + 15_000);
    const waiting = given('The bot.').leaseJob(NOW).waitJob(at);

    expect(waiting.job.attempts).toBe(0);
    expect(waiting.job.isDue(LATER)).toBe(false);
    expect(waiting.job.waitingSince).toEqual(at);
    expect(waiting.gradingRound.equals(given('The bot.').gradingRound)).toBe(
      true,
    );
  });

  it('wakes the job that waits for the session grading its reply, and nothing else', () => {
    const waiting = given('The bot.').leaseJob(NOW).waitJob(NOW);
    const round = given('The bot.').leaseJob(NOW).gradingRound;

    expect(waiting.wake(round, LATER).job.isDue(LATER)).toBe(true);
    expect(
      waiting.wake(
        GradingRound.of({
          answerId: round.answerId,
          answeredAt: LATER,
          attempt: 1,
        }),
        LATER,
      ),
    ).toBe(waiting);

    const leased = given('The bot.').leaseJob(NOW);
    expect(leased.wake(round, LATER)).toBe(leased);
  });

  it('stays ungraded where its session cannot run, and grades again after any other failure', () => {
    for (const reason of ['no-harness', 'base-run-elsewhere'] as const) {
      expect(
        given('The bot.')
          .leaseJob(NOW)
          .gradingFailed(SessionFailure.of(reason), LATER).grading,
      ).toBe('failed');
    }

    for (const reason of ['run-failed', 'no-result'] as const) {
      const retried = given('The bot.')
        .leaseJob(NOW)
        .gradingFailed(SessionFailure.of(reason), LATER);

      expect(retried.grading).toBe('pending');
      expect(retried.job.isDue(LATER)).toBe(false);
    }
  });

  it('grades again in a new round after a failed session, and stays ungraded once its attempts run out', () => {
    const once = given('The bot.').leaseJob(NOW);
    const retried = once.scheduleRetry(NOW);

    expect(retried.grading).toBe('pending');
    expect(retried.leaseJob(LATER).gradingRound.equals(once.gradingRound)).toBe(
      false,
    );

    let exhausted = given('The bot.');
    for (let at = 0; at < MAX_JOB_ATTEMPTS; at += 1) {
      exhausted = exhausted.leaseJob(new Date(NOW.getTime() + at * 3_600_000));
    }
    const ungraded = exhausted.scheduleRetry(LATER);

    expect(ungraded.grading).toBe('failed');
    expect(ungraded.verdict).toBeNull();
    expect(ungraded.hasPendingJob).toBe(false);
  });

  it('cannot be graded once nothing waits for a grade', () => {
    expect(() => given(null).leaseJob(NOW)).toThrow(InvalidAnswerError);
    expect(given(null).ungraded().grading).toBe('graded');
  });

  it('refuses a stored grading that does not match its verdict', () => {
    const answer = given('The bot.');
    const stored = {
      id: answer.id,
      workspaceId: answer.workspaceId,
      taskId: answer.taskId,
      teamId: answer.teamId,
      stackId: answer.stackId,
      repository: answer.repository,
      questionId: answer.questionId,
      personId: answer.personId,
      asked: answer.asked,
      expected: answer.expected,
      reply: answer.reply,
      feedback: null,
      usage: answer.usage,
      job: answer.job,
      answeredAt: answer.answeredAt,
      version: 0,
    };

    expect(() =>
      QuestionAnswer.rehydrate({
        ...stored,
        grading: 'pending',
        verdict: 'right',
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      QuestionAnswer.rehydrate({ ...stored, grading: 'graded', verdict: null }),
    ).toThrow(InconsistentStateError);
    expect(
      QuestionAnswer.rehydrate({ ...stored, grading: 'failed', verdict: null })
        .grading,
    ).toBe('failed');
  });

  it('answers a question only while the stack still asks it in the same words', () => {
    const answer = given(null);

    expect(answer.answers(QUESTION)).toBe(true);
    expect(answer.answers({ ...QUESTION, question: 'Who signs it now?' })).toBe(
      false,
    );
  });

  it('answers again only after the stack asks the question in other words, and waits for a new grade', () => {
    const answer = given(null);

    expect(() =>
      answer.answeredAgain({
        question: QUESTION,
        reply: null,
        now: LATER,
      }),
    ).toThrow('You already answered this question.');

    const again = answer.answeredAgain({
      question: { ...QUESTION, question: 'Who signs it now?' },
      reply: 'The integration.',
      now: LATER,
    });

    expect(again.id).toEqual(answer.id);
    expect(again.asked).toBe('Who signs it now?');
    expect(again.grading).toBe('pending');
    expect(again.verdict).toBeNull();
    expect(again.answeredAt).toEqual(LATER);
    expect(again.gradingRound.equals(answer.gradingRound)).toBe(false);
  });

  it('stops answering a question once its expected answer changes', () => {
    expect(
      given(null).answers({ ...QUESTION, answer: 'Nobody signs it.' }),
    ).toBe(false);
  });

  it('is refused while the person answered the question on another stack of the task and repository', () => {
    const answer = given(null);
    const elsewhere = {
      id: ChangeStackId.of('stack-2'),
      taskId: TaskId.of('task-1'),
      repository: null,
    };

    expect(() =>
      QuestionAnswer.refuseIfAnsweredIn([answer], QUESTION, elsewhere),
    ).toThrow('You already answered this question.');
    expect(() =>
      QuestionAnswer.refuseIfAnsweredIn([answer], QUESTION, {
        ...elsewhere,
        repository: RepositoryName.of('api'),
      }),
    ).not.toThrow();
  });
});
