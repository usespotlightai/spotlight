import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatRunNotStarted implements DomainEvent {
  readonly kind = 'chat.run-not-started';

  constructor(
    readonly chatId: ChatId,
    readonly runId: RunId,
  ) {}
}
