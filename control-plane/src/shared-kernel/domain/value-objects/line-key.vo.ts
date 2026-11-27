import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class LineKey {
  private readonly kind = 'line-key';

  private constructor(readonly value: string) {}

  static of(raw: string): LineKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('line key', 'web-app');
    }

    return new LineKey(named);
  }

  equals(other: LineKey): boolean {
    return other instanceof LineKey && this.value === other.value;
  }

  compare(other: LineKey): number {
    if (this.value === other.value) {
      return 0;
    }

    return this.value < other.value ? -1 : 1;
  }

  toString(): string {
    return this.value;
  }
}
