import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class UserEmailId {
  private readonly kind = 'user-email';

  private constructor(readonly value: string) {}

  static of(value: string): UserEmailId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('user email');
    }
    return new UserEmailId(value);
  }

  equals(other: UserEmailId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
