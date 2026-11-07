import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TaskChangeShaped implements DomainEvent {
  readonly kind = 'task-change-shape.shaped';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
