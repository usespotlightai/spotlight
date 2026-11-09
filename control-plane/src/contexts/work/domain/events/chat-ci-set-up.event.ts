import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ChatCiSetUp implements DomainEvent {
  readonly kind = 'chat.ci-set-up';

  constructor(
    readonly chatId: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly startedBy: UserId,
  ) {}
}
