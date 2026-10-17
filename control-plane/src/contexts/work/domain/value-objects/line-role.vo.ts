import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class LineRole {
  private readonly kind = 'line-role';

  private constructor(readonly value: string) {}

  static readonly DELIVERY = new LineRole('delivery');

  static readonly REVIEW = new LineRole('review');

  static of(raw: string): LineRole {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'line role',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in delivery`,
      );
    }

    return new LineRole(named);
  }

  equals(other: LineRole): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
