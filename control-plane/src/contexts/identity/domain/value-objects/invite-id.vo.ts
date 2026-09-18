import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class InviteId {
  private readonly kind = 'invite';

  private constructor(readonly value: string) {}

  static of(value: string): InviteId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('invite');
    }
    return new InviteId(value);
  }

  equals(other: InviteId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
