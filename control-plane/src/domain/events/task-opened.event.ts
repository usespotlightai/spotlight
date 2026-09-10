import type { DomainEvent } from '@domain/events/domain-event';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * A task has been opened. Recorded so somewhere it came from — a chat thread a
 * mention arrived in — can be told it was heard, before the work has anything
 * to say.
 */
export class TaskOpened implements DomainEvent {
  readonly kind = 'task.opened';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
  ) {}
}
