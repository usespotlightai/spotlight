import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const MAX_LENGTH = 4_000;

export class Hypothesis {
  private constructor(readonly value: string) {}

  static of(raw: string): Hypothesis {
    const said = raw.trim();

    if (said.length === 0 || said.length > MAX_LENGTH) {
      throw new InvalidCandidateError(
        `hypothesis must be 1 to ${MAX_LENGTH.toLocaleString('en-US')} characters`,
      );
    }

    return new Hypothesis(said);
  }

  equals(other: Hypothesis): boolean {
    return this.value === other.value;
  }
}
