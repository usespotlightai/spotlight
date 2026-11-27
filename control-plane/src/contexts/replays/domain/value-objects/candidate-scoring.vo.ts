import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import type { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

export class CandidateScoring {
  private constructor(
    readonly checksChanges: boolean,
    readonly judge: JudgeCriteria | null,
    readonly rubricVersion: RubricVersion | null,
  ) {}

  static of(input: {
    checksChanges: boolean;
    judge: JudgeCriteria | null;
    rubricVersion: RubricVersion | null;
  }): CandidateScoring {
    if ((input.judge === null) !== (input.rubricVersion === null)) {
      throw new InvalidCandidateError(
        'rubric version must be set only when the scoring has a judge',
      );
    }

    return new CandidateScoring(
      input.checksChanges,
      input.judge,
      input.rubricVersion,
    );
  }

  get judges(): boolean {
    return this.judge !== null;
  }

  /** A config can be scored only by a judge or by a check of its changes. */
  get scores(): boolean {
    return this.judges || this.checksChanges;
  }

  equals(other: CandidateScoring): boolean {
    return (
      this.checksChanges === other.checksChanges &&
      (this.judge === null
        ? other.judge === null
        : other.judge !== null && this.judge.equals(other.judge)) &&
      this.rubricVersion === other.rubricVersion
    );
  }
}
