import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

export class ChatId {
  private readonly kind = 'chat';

  private constructor(readonly value: string) {}

  static of(value: string): ChatId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('chat');
    }
    return new ChatId(value);
  }

  equals(other: ChatId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
