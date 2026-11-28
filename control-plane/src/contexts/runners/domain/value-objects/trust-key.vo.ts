import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TrustKey {
  private readonly kind = 'trust-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TrustKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug(
        'runner trust key',
        'production-cluster',
      );
    }

    return new TrustKey(named);
  }

  equals(other: TrustKey): boolean {
    return other instanceof TrustKey && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
