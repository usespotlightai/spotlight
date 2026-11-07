import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class TaskMarked implements DomainEvent {
  readonly kind = 'task.marked';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly mark: Mark,
  ) {}
}
