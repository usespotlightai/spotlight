import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';

export class TaskMoved implements DomainEvent {
  readonly kind = 'task.moved';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly from: StationKey,
    readonly to: StationKey,
    readonly at: Date,
  ) {}
}
