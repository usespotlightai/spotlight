import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';

const MAX_LENGTH = 80;

export class ChatTitle {
  private constructor(readonly value: string) {}

  static of(raw: string): ChatTitle {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidChatMessageError('must say something to be named by');
    }

    return new ChatTitle(trimmed.slice(0, MAX_LENGTH).trimEnd());
  }

  static openedWith(body: string): ChatTitle {
    const first = body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    return ChatTitle.of(first ?? body);
  }

  equals(other: ChatTitle): boolean {
    return this.value === other.value;
  }
}
