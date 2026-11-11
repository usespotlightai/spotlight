import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TaskChangeShapeErased implements DomainEvent {
  readonly kind = 'task-change-shape.erased';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
