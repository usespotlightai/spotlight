import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class ChangeStackId {
  private readonly kind = 'change-stack';

  private constructor(readonly value: string) {}

  static of(value: string): ChangeStackId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('change stack');
    }
    return new ChangeStackId(value);
  }

  equals(other: ChangeStackId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
