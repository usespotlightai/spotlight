import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TrustKey {
  private readonly kind = 'trust-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TrustKey {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'runner trust key',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in production-cluster`,
      );
    }

    return new TrustKey(named);
  }

  equals(other: TrustKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
