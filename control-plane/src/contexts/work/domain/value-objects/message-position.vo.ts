import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';

export class MessagePosition {
  private readonly kind = 'message-position';

  private constructor(readonly value: number) {}

  static of(value: number): MessagePosition {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidChatMessageError(
        `position must be a whole number from 0, not ${value}`,
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
