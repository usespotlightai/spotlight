import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class EgressKey {
  private readonly kind = 'egress-key';

  private constructor(readonly value: string) {}

  static of(raw: string): EgressKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('egress key', 'office-proxy');
    }

    return new EgressKey(named);
  }

  equals(other: EgressKey): boolean {
    return other instanceof EgressKey && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
