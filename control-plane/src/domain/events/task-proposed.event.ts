import type { DomainEvent } from '@domain/events/domain-event';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';

export class TaskProposed implements DomainEvent {
  readonly kind = 'chat.task-proposed';

  constructor(
    readonly chatId: ChatId,
    readonly position: MessagePosition,
    readonly placement: ProposalPlacement,
  ) {}
}
