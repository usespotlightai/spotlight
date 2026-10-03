import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import type { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';

export class CandidateScoring {
  private constructor(
    readonly checksChanges: boolean,
    readonly judge: JudgeCriteria | null,
    readonly rubricVersion: string | null,
  ) {}

  static of(input: {
    checksChanges: boolean;
    judge: JudgeCriteria | null;
    rubricVersion: string | null;
  }): CandidateScoring {
    if ((input.judge === null) !== (input.rubricVersion === null)) {
      throw new InvalidCandidateError(
        'names the version of its judge’s rubric when, and only when, it has one',
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
