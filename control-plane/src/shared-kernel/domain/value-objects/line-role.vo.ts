import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class LineRole {
  private readonly kind = 'line-role';

  private constructor(readonly value: string) {}

  static readonly DELIVERY = new LineRole('delivery');

  static readonly REVIEW = new LineRole('review');

  static of(raw: string): LineRole {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('line role', 'delivery');
    }

    return new LineRole(named);
  }

  equals(other: LineRole): boolean {
    return other instanceof LineRole && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
