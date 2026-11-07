import { QuestionAnswer } from '@change-review/domain/aggregates/question-answer.aggregate';
import { InvalidAnswerError } from '@change-review/domain/exceptions/invalid-answer.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { LayerQuestion } from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  HunkId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
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

const given = (
  reply: string | null,
  graded: Parameters<typeof QuestionAnswer.given>[0]['graded'] = null,
) =>
  QuestionAnswer.given({
    id: QuestionAnswerId.of('answer-1'),
    stack: {
      id: ChangeStackId.of('stack-1'),
      workspaceId: WorkspaceId.of('workspace-1'),
      taskId: TaskId.of('task-1'),
      teamId: null,
    },
    question: QUESTION,
    personId: UserId.of('user-1'),
    reply,
    graded,
    now: new Date('2026-11-02T10:00:00Z'),
  });

describe('QuestionAnswer', () => {
  it('takes the grade of an answer in words, and keeps what it was graded against', () => {
    const answer = given(' The bot signs it. ', {
      grade: { verdict: 'partly-right', feedback: ' The integration signs. ' },
      usage: { inputTokens: 300, outputTokens: 40, cost: null },
    });

    expect(answer.reply).toBe('The bot signs it.');
    expect(answer.verdict).toBe('partly-right');
    expect(answer.feedback).toBe('The integration signs.');
    expect(answer.asked).toBe(QUESTION.question);
    expect(answer.expected).toBe('The integration signs it.');
    expect(answer.usage.calls).toBe(1);
  });

  it('keeps at most the feedback it has room for', () => {
    const answer = given('The bot.', {
      grade: { verdict: 'missed', feedback: 'x'.repeat(2_500) },
      usage: null,
    });

    expect(answer.feedback).toHaveLength(2_000);
  });

  it('counts “I don’t know” as missed, with no grade and no feedback', () => {
    for (const reply of [null, '   ']) {
      const answer = given(reply);

      expect(answer.reply).toBeNull();
      expect(answer.verdict).toBe('missed');
      expect(answer.feedback).toBeNull();
      expect(answer.usage.calls).toBe(0);
    }
  });

  it('refuses an answer in words without a grade, a grade without words, or a reply too long', () => {
    const grade = {
      grade: { verdict: 'right' as const, feedback: '' },
      usage: null,
    };

    expect(() => given('The integration.')).toThrow(InvalidAnswerError);
    expect(() => given(null, grade)).toThrow(InvalidAnswerError);
    expect(() => given('x'.repeat(4_001), grade)).toThrow(
      'An answer must be at most 4000 characters.',
    );
  });

  it('answers a question only while the stack still asks it in the same words', () => {
    const answer = given(null);

    expect(answer.answers(QUESTION)).toBe(true);
    expect(answer.answers({ ...QUESTION, question: 'Who signs it now?' })).toBe(
      false,
    );
  });

  it('answers again only after the stack asks the question in other words', () => {
    const answer = given(null);

    expect(() =>
      answer.answeredAgain({
        question: QUESTION,
        reply: null,
        graded: null,
        now: new Date('2026-11-02T11:00:00Z'),
      }),
    ).toThrow('You already answered this question.');

    const again = answer.answeredAgain({
      question: { ...QUESTION, question: 'Who signs it now?' },
      reply: 'The integration.',
      graded: {
        grade: { verdict: 'right', feedback: '' },
        usage: { inputTokens: 1, outputTokens: 1, cost: null },
      },
      now: new Date('2026-11-02T11:00:00Z'),
    });

    expect(again.id).toEqual(answer.id);
    expect(again.asked).toBe('Who signs it now?');
    expect(again.verdict).toBe('right');
    expect(again.feedback).toBeNull();
    expect(again.usage.calls).toBe(1);
  });
});
