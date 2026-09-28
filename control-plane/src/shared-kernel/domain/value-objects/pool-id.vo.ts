import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class PoolId {
  private readonly kind = 'pool';

  private constructor(readonly value: string) {}

  static of(value: string): PoolId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('runner pool');
    }
    return new PoolId(value);
  }

  equals(other: PoolId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
