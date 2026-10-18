import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ChatDispatched implements DomainEvent {
  readonly kind = 'chat.dispatched';

  constructor(
    readonly chatId: ChatId,
    readonly runId: RunId,
    readonly acknowledged: readonly MessagePosition[],
  ) {}
}
