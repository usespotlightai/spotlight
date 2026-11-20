import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class HeldForAgentChatError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    taskId: TaskId,
    readonly by: UserId,
  ) {
    super(
      `Task ${taskId.value} is on hold for an agent chat of another person.`,
    );
    this.name = 'HeldForAgentChatError';
  }
}
