import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TokenName {
  private readonly kind = 'token-name';

  private constructor(readonly value: string) {}

  static of(raw: string): TokenName {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('token name', 'ci-deploy');
    }

    return new TokenName(named);
  }

  equals(other: TokenName): boolean {
    return other instanceof TokenName && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
