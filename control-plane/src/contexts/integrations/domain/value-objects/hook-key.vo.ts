import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class HookKey {
  private constructor(readonly value: string) {}

  static of(raw: string): HookKey {
    const trimmed = raw.trim();

    if (!areWords(trimmed)) {
      throw new InvalidIdentifierError(
        'hook',
        `is lower case words joined by dashes, at most ${LONGEST_WORDS} characters, as in migrations-need-a-dba`,
      );
    }

    return new HookKey(trimmed);
  }

  equals(other: HookKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
