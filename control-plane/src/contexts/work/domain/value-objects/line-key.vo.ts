import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class LineKey {
  private readonly kind = 'line-key';

  private constructor(readonly value: string) {}

  static of(raw: string): LineKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'line key',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in default`,
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
