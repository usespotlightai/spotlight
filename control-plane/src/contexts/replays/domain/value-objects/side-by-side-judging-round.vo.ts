import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

/** One try at judging two runs' changes side by side. A try that failed and is retried is a new round with new sessions. */
export class SideBySideJudgingRound {
  private readonly kind: string = 'side-by-side-judging-round';

  private constructor(
    readonly runId: RunId,
    readonly otherRunId: RunId,
    readonly attempt: number,
  ) {}

  static of(input: {
    runId: RunId;
    otherRunId: RunId;
    attempt: number;
  }): SideBySideJudgingRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InvalidJudgingError(
        `counts its tries from 1, not ${input.attempt}`,
      );
    }

    return new SideBySideJudgingRound(
      input.runId,
      input.otherRunId,
      input.attempt,
    );
  }

  equals(other: SideBySideJudgingRound): boolean {
    return (
      this.kind === other.kind &&
      this.runId.equals(other.runId) &&
      this.otherRunId.equals(other.otherRunId) &&
      this.attempt === other.attempt
    );
  }
}
