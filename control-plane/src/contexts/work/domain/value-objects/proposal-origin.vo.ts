import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ProposalOrigin {
  private constructor(
    readonly chatId: ChatId,
    readonly position: MessagePosition,
  ) {}

  static of(input: {
    chatId: ChatId;
    position: MessagePosition;
  }): ProposalOrigin {
    return new ProposalOrigin(input.chatId, input.position);
  }

  equals(other: ProposalOrigin): boolean {
    return (
      this.chatId.equals(other.chatId) && this.position.equals(other.position)
    );
  }
}
