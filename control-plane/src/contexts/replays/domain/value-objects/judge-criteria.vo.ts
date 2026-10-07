import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

export class JudgeCriteria {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passShare: number,
  ) {}

  static of(input: {
    rubric: string | null;
    claims: readonly string[];
    passShare: number;
  }): JudgeCriteria {
    if (input.rubric === null && input.claims.length === 0) {
      throw new InvalidCandidateError('judge must use a rubric or claims');
    }
    if (
      !Number.isFinite(input.passShare) ||
      input.passShare < 0 ||
      input.passShare > 1
    ) {
      throw new InvalidCandidateError('judge pass share must be from 0 to 1');
    }

    return new JudgeCriteria(input.rubric, [...input.claims], input.passShare);
  }

  equals(other: JudgeCriteria): boolean {
    return (
      this.rubric === other.rubric &&
      this.passShare === other.passShare &&
      this.claims.length === other.claims.length &&
      this.claims.every((each, at) => each === other.claims[at])
    );
  }
}
