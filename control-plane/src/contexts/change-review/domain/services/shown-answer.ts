import type { AnswerVerdict } from '@change-review/domain/value-objects/answer-verdict.vo';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface AskedQuestion {
  readonly question: string;
  readonly answer: string;
}

export interface AnswerScope {
  readonly stackId: ChangeStackId;
  readonly taskId: TaskId | null;
  readonly repository: RepositoryName | null;
}

export interface GivenAnswer extends AnswerScope {
  readonly id: QuestionAnswerId;
  readonly asked: string;
  readonly expected: string;
  readonly reply: string | null;
  readonly verdict: AnswerVerdict;
  readonly feedback: string | null;
  readonly answeredAt: Date;
}

export interface ShownAnswer {
  readonly reply: string | null;
  readonly verdict: AnswerVerdict;
  readonly feedback: string | null;
  readonly expected: string | null;
  readonly outdated: boolean;
}

const sameRepository = (
  a: RepositoryName | null,
  b: RepositoryName | null,
): boolean => (a && b ? a.value === b.value : a === b);

export const sharesAnswers = (a: AnswerScope, b: AnswerScope): boolean =>
  a.stackId.equals(b.stackId) ||
  (a.taskId !== null &&
    b.taskId?.equals(a.taskId) === true &&
    sameRepository(a.repository, b.repository));

export const answersQuestion = (
  answer: Pick<GivenAnswer, 'asked' | 'expected'>,
  question: AskedQuestion,
): boolean =>
  question.question === answer.asked && question.answer === answer.expected;

const latestOf = <A extends GivenAnswer>(answers: readonly A[]): A | null =>
  answers.reduce<A | null>(
    (latest, each) =>
      !latest ||
      each.answeredAt > latest.answeredAt ||
      (each.answeredAt.getTime() === latest.answeredAt.getTime() &&
        each.id.value > latest.id.value)
        ? each
        : latest,
    null,
  );

export const shownAnswerFor = (
  question: AskedQuestion,
  stack: AnswerScope,
  answers: readonly GivenAnswer[],
): ShownAnswer | null => {
  const shared = answers.filter(
    (each) => sharesAnswers(each, stack) && each.asked === question.question,
  );
  const current = latestOf(
    shared.filter((each) => answersQuestion(each, question)),
  );

  if (current) {
    return {
      reply: current.reply,
      verdict: current.verdict,
      feedback: current.feedback,
      expected: current.expected,
      outdated: false,
    };
  }

  const earlier = latestOf(shared);

  return earlier
    ? {
        reply: earlier.reply,
        verdict: earlier.verdict,
        feedback: null,
        expected: null,
        outdated: true,
      }
    : null;
};
