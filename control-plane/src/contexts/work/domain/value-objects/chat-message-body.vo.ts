import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

const MAX_LENGTH = 20_000;

export class ChatMessageBody {
  private constructor(readonly value: string) {}

  static of(raw: string): ChatMessageBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidChatMessageError('must say something or attach a file');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidChatMessageError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new ChatMessageBody(trimmed);
  }

  static given(
    raw: string,
    attachments: readonly Attachment[] = [],
  ): ChatMessageBody {
    const names = attachments.map((each) => each.name).join(', ');

    return ChatMessageBody.of(
      raw.trim() || (names ? `Attached ${names}.` : ''),
    );
  }

  equals(other: ChatMessageBody): boolean {
    return this.value === other.value;
  }
}
