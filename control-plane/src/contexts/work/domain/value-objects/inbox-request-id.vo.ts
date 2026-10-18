import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class InboxRequestId {
  private readonly kind = 'inbox-request';

  private constructor(readonly value: string) {}

  static of(value: string): InboxRequestId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('inbox request');
    }
    return new InboxRequestId(value);
  }

  equals(other: InboxRequestId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
