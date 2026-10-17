import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class EgressKey {
  private readonly kind = 'egress-key';

  private constructor(readonly value: string) {}

  static of(raw: string): EgressKey {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'egress key',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in shared`,
      );
    }

    return new EgressKey(named);
  }

  equals(other: EgressKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
