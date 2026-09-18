import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ProposalDismissed implements DomainEvent {
  readonly kind = 'chat.proposal-dismissed';

  constructor(
    readonly chatId: ChatId,
    readonly position: MessagePosition,
  ) {}
}
