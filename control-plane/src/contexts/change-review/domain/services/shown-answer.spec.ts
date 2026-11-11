import { shownAnswerFor } from '@change-review/domain/services/shown-answer';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const QUESTION = {
  question: 'Who signs a message when the member has left?',
  answer: 'The integration signs it.',
};

const STACK = {
  stackId: ChangeStackId.of('stack-2'),
  taskId: TaskId.of('task-1'),
  repository: RepositoryName.of('web'),
};

const at = (
  iso: string,
  expected: string,
  over: { taskId?: TaskId | null; repository?: RepositoryName } = {},
) => ({
  id: QuestionAnswerId.of(`answer-${iso}`),
  stackId: ChangeStackId.of('stack-1'),
  taskId: TaskId.of('task-1'),
  repository: RepositoryName.of('web'),
  asked: QUESTION.question,
  expected,
  reply: `Reply at ${iso}`,
  verdict: 'right' as const,
  feedback: 'Well read.',
  answeredAt: new Date(iso),
  ...over,
});

describe('shownAnswerFor', () => {
  it('is the answer to the question as it is asked now, from any stack of the task and repository', () => {
    expect(
      shownAnswerFor(QUESTION, STACK, [
        at('2026-11-03T10:00:00Z', 'An older answer.'),
        at('2026-11-02T10:00:00Z', QUESTION.answer),
      ]),
    ).toEqual({
      reply: 'Reply at 2026-11-02T10:00:00Z',
      verdict: 'right',
      feedback: 'Well read.',
      expected: QUESTION.answer,
      outdated: false,
    });
  });

  it('is the latest earlier answer once the expected answer changed, without its feedback or expected answer', () => {
    expect(
      shownAnswerFor(QUESTION, STACK, [
        at('2026-11-02T10:00:00Z', 'An old answer.'),
        at('2026-11-03T10:00:00Z', 'A later old answer.'),
      ]),
    ).toEqual({
      reply: 'Reply at 2026-11-03T10:00:00Z',
      verdict: 'right',
      feedback: null,
      expected: null,
      outdated: true,
    });
  });

  it('is nothing for a question asked in other words, or answered in another repository or task', () => {
    expect(
      shownAnswerFor({ ...QUESTION, question: 'Who signs it now?' }, STACK, [
        at('2026-11-02T10:00:00Z', QUESTION.answer),
      ]),
    ).toBeNull();
    expect(
      shownAnswerFor(QUESTION, STACK, [
        at('2026-11-02T10:00:00Z', QUESTION.answer, {
          repository: RepositoryName.of('api'),
        }),
        at('2026-11-02T11:00:00Z', QUESTION.answer, {
          taskId: TaskId.of('task-2'),
        }),
      ]),
    ).toBeNull();
  });

  it('shares answers only within the stack itself when it has no task', () => {
    expect(
      shownAnswerFor(QUESTION, { ...STACK, taskId: null }, [
        at('2026-11-02T10:00:00Z', QUESTION.answer, { taskId: null }),
      ]),
    ).toBeNull();
  });
});
