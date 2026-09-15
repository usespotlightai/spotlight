import { InvalidChatMessageError } from '@domain/exceptions/invalid-chat-message.error';

export class MessagePosition {
  private readonly kind = 'message-position';

  private constructor(readonly value: number) {}

  static of(value: number): MessagePosition {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidChatMessageError(
        `cannot stand at ${value}; places are whole numbers from 0`,
      );
    }

    return new MessagePosition(value);
  }

  isAtOrBefore(other: MessagePosition): boolean {
    return this.value <= other.value;
  }

  equals(other: MessagePosition): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
