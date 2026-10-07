import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class ProfileKey {
  private constructor(readonly value: string) {}

  static of(raw: string): ProfileKey {
    const trimmed = raw.trim();

    if (!areWords(trimmed)) {
      throw new InvalidIdentifierError(
        'harness profile',
        `must be lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in careful`,
      );
    }

    return new ProfileKey(trimmed);
  }

  equals(other: ProfileKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
