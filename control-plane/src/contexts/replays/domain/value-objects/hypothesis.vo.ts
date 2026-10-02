import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const MOST_LENGTH = 4_000;

export class Hypothesis {
  private constructor(readonly value: string) {}

  static of(raw: string): Hypothesis {
    const said = raw.trim();

    if (said.length === 0 || said.length > MOST_LENGTH) {
      throw new InvalidCandidateError(
        `found by a search says what it expects to improve, and why, in 1 to ${MOST_LENGTH.toLocaleString('en-US')} characters`,
      );
    }

    return new Hypothesis(said);
  }

  equals(other: Hypothesis): boolean {
    return this.value === other.value;
  }
}
