import { InvalidAnswerError } from '@change-review/domain/exceptions/invalid-answer.error';
import type { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';

/**
 * One session that grades an answer: the answer, the reply it grades (by when it was given) and the attempt of the
 * answer's job. Answering again or retrying the job grades in a new round; a job that waits keeps its round.
 */
export class GradingRound {
  private constructor(
    readonly answerId: QuestionAnswerId,
    readonly answeredAt: Date,
    readonly attempt: number,
  ) {}

  static of(input: {
    answerId: QuestionAnswerId;
    answeredAt: Date;
    attempt: number;
  }): GradingRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 0) {
      throw new InvalidAnswerError(
        `cannot be graded in attempt ${input.attempt}`,
      );
    }

    return new GradingRound(input.answerId, input.answeredAt, input.attempt);
  }

  /** Whether it grades the same reply, in whichever attempt. */
  gradesReplyOf(answerId: QuestionAnswerId, answeredAt: Date): boolean {
    return (
      this.answerId.equals(answerId) &&
      this.answeredAt.getTime() === answeredAt.getTime()
    );
  }

  equals(other: GradingRound): boolean {
    return (
      other.gradesReplyOf(this.answerId, this.answeredAt) &&
      this.attempt === other.attempt
    );
  }
}
