import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

export class CandidateScoring {
  private constructor(
    readonly checksChanges: boolean,
    readonly rubric: string | null,
    readonly rubricVersion: string | null,
  ) {}

  static of(input: {
    checksChanges: boolean;
    rubric: string | null;
    rubricVersion: string | null;
  }): CandidateScoring {
    if ((input.rubric === null) !== (input.rubricVersion === null)) {
      throw new InvalidCandidateError(
        'names the version of its judge’s rubric when, and only when, it has one',
      );
    }

    return new CandidateScoring(
      input.checksChanges,
      input.rubric,
      input.rubricVersion,
    );
  }

  get judges(): boolean {
    return this.rubric !== null;
  }

  equals(other: CandidateScoring): boolean {
    return (
      this.checksChanges === other.checksChanges &&
      this.rubric === other.rubric &&
      this.rubricVersion === other.rubricVersion
    );
  }
}
