import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class PushDiffId {
  private readonly kind: string = 'push-diff';

  private constructor(readonly value: string) {}

  static of(value: string): PushDiffId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('push diff');
    }
    return new PushDiffId(value);
  }

  equals(other: PushDiffId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
