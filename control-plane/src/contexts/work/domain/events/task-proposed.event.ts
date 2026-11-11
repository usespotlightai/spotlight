import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

export class TaskProposed implements DomainEvent {
  readonly kind = 'chat.task-proposed';

  constructor(
    readonly chatId: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly startedBy: UserId,
    readonly position: MessagePosition,
    readonly by: RunId,
  ) {}
}
