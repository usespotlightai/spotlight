import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class CheckWorkId {
  private readonly kind = 'check-work';

  private constructor(readonly value: string) {}

  static of(value: string): CheckWorkId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('check');
    }
    return new CheckWorkId(value);
  }

  equals(other: CheckWorkId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
