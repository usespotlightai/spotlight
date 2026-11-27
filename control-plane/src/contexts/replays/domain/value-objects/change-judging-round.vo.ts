import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

/**
 * One try at judging a run's change: which judging of the run it is, and which try of that judging. A change judged
 * again, or a try that failed and is retried, is a new round with a new judging session.
 */
export class ChangeJudgingRound {
  private readonly kind: string = 'change-judging-round';

  private constructor(
    readonly runId: RunId,
    readonly judging: JudgingAttempt,
    readonly attempt: number,
  ) {}

  static of(input: {
    runId: RunId;
    judging: JudgingAttempt;
    attempt: number;
  }): ChangeJudgingRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InvalidJudgingError(
        `counts its tries from 1, not ${input.attempt}`,
      );
    }

    return new ChangeJudgingRound(input.runId, input.judging, input.attempt);
  }

  equals(other: ChangeJudgingRound): boolean {
    return (
      this.kind === other.kind &&
      this.runId.equals(other.runId) &&
      this.judging === other.judging &&
      this.attempt === other.attempt
    );
  }
}
