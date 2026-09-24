import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import { DONE, REVIEW } from '@work/domain/value-objects/handover-word';

const RESERVED: ReadonlyMap<string, string> = new Map([
  [REVIEW, 'hand its task over to a person'],
  [DONE, 'finish its task'],
]);

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

    const reserved = RESERVED.get(named);

    if (reserved) {
      throw new InvalidIdentifierError(
        'station key',
        `cannot be ${named}, which is reserved because a run says ${named} to ${reserved}; pick another key, as in code-review`,
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
