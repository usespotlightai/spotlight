import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@domain/value-objects/identifier-shapes';

export class LineKey {
  private readonly kind = 'line-key';

  private constructor(readonly value: string) {}

  static of(raw: string): LineKey {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'line key',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in default`,
      );
    }

    return new LineKey(named);
  }

  equals(other: LineKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
