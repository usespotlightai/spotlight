import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The task moved into the Completed station of its line. A task that finishes at the end of its line, with its pull request still open, is finished but not completed.
export class TaskCompleted implements DomainEvent {
  readonly kind = 'task.completed';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly at: Date,
  ) {}
}
