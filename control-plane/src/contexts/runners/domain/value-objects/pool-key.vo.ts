import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const PLATFORM = 'spotlight';

export class PoolKey {
  private readonly kind = 'pool-key';

  private constructor(readonly value: string) {}

  // The key of the platform pool that Spotlight adds to each workspace.
  static platform(): PoolKey {
    return new PoolKey(PLATFORM);
  }

  static of(raw: string): PoolKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('runner pool key', 'dev-host');
    }

    return new PoolKey(named);
  }

  equals(other: PoolKey): boolean {
    return other instanceof PoolKey && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
