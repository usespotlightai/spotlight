import { InvalidJudgingError } from '@insights/domain/exceptions/invalid-judging.error';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

/**
 * One try at judging a run on one rubric. A run judged again on a new rubric, or a try that failed and is retried,
 * is a new round, so it orders a new judging session; the same round reads its session back.
 */
export class JudgingRound {
  private readonly kind = 'judging-round';

  private constructor(
    readonly runId: RunId,
    readonly rubricVersion: RubricVersion,
    readonly attempt: number,
  ) {}

  static of(input: {
    runId: RunId;
    rubricVersion: RubricVersion;
    attempt: number;
  }): JudgingRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      throw new InvalidJudgingError(
        `counts its tries from 1, not ${input.attempt}`,
      );
    }

    return new JudgingRound(input.runId, input.rubricVersion, input.attempt);
  }

  equals(other: JudgingRound): boolean {
    return (
      other instanceof JudgingRound &&
      this.runId.equals(other.runId) &&
      this.rubricVersion === other.rubricVersion &&
      this.attempt === other.attempt
    );
  }
}
