import type { DomainEvent } from '@domain/events/domain-event';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class TaskFinished implements DomainEvent {
  readonly kind = 'task.finished';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly at: Date,
  ) {}
}
