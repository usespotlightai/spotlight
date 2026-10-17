import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class PoolKey {
  private readonly kind = 'pool-key';

  private constructor(readonly value: string) {}

  static of(raw: string): PoolKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'runner pool key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in ephemeral`,
      );
    }

    return new PoolKey(named);
  }

  equals(other: PoolKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
