import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { DONE, REVIEW } from '@domain/value-objects/handover-word';
import {
  areWords,
  LONGEST_WORDS,
} from '@domain/value-objects/identifier-shapes';

export class StationKey {
  private readonly kind = 'station-key';

  private constructor(readonly value: string) {}

  static of(raw: string): StationKey {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'station key',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in code-review`,
      );
    }

    if (named === REVIEW || named === DONE) {
      throw new InvalidIdentifierError(
        'station key',
        `is never ${named}, which a run says to reach a person or to finish`,
      );
    }

    return new StationKey(named);
  }

  equals(other: StationKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
