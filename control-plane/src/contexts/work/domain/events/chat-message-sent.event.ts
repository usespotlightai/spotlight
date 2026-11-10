import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class ChatMessageSent implements DomainEvent {
  readonly kind = 'chat.message-sent';

  constructor(
    readonly chatId: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly position: MessagePosition,
    readonly by: UserId,
  ) {}
}
