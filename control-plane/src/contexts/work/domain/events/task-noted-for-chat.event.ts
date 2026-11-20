import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class TaskNotedForChat implements DomainEvent {
  readonly kind = 'task.noted-for-chat';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly chatId: ChatId,
    readonly body: string,
    readonly wakes: boolean,
    readonly at: Date,
  ) {}
}
