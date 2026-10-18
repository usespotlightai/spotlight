import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

export class JudgeCriteria {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
  ) {}

  static of(input: {
    rubric: string | null;
    claims: readonly string[];
    passThreshold: number;
  }): JudgeCriteria {
    if (input.rubric === null && input.claims.length === 0) {
      throw new InvalidCandidateError('judge must use a rubric or claims');
    }
    if (
      !Number.isFinite(input.passThreshold) ||
      input.passThreshold < 0 ||
      input.passThreshold > 1
    ) {
      throw new InvalidCandidateError(
        'judge pass threshold must be from 0 to 1',
      );
    }

    return new JudgeCriteria(
      input.rubric,
      [...input.claims],
      input.passThreshold,
    );
  }

  equals(other: JudgeCriteria): boolean {
    return (
      this.rubric === other.rubric &&
      this.passThreshold === other.passThreshold &&
      this.claims.length === other.claims.length &&
      this.claims.every((each, at) => each === other.claims[at])
    );
  }
}
