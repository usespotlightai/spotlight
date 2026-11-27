import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class PushDiffId {
  private readonly kind = 'push-diff';

  private constructor(readonly value: string) {}

  static of(value: string): PushDiffId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('push diff');
    }
    return new PushDiffId(value);
  }

  equals(other: PushDiffId): boolean {
    return other instanceof PushDiffId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
