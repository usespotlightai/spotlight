import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TokenName {
  private readonly kind = 'token-name';

  private constructor(readonly value: string) {}

  static of(raw: string): TokenName {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'token name',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in ci`,
      );
    }

    return new TokenName(named);
  }

  equals(other: TokenName): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
