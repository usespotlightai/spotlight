import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ReplayCheckId {
  private readonly kind = 'replay-check';

  private constructor(readonly value: string) {}

  static of(value: string): ReplayCheckId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('replay check');
    }
    return new ReplayCheckId(value);
  }

  equals(other: ReplayCheckId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
