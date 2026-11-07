import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TaskOpeningRecorded implements DomainEvent {
  readonly kind = 'task-human-actions.opening-recorded';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
