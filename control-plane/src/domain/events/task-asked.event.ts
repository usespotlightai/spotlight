import type { DomainEvent } from '@domain/events/domain-event';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * A task has been put to a person: a run finished with a question rather than a
 * next station, and it now waits in an inbox. Recorded so somewhere other than
 * the inbox — a chat thread — can carry the question too.
 */
export class TaskAsked implements DomainEvent {
  readonly kind = 'task.asked';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly assignee: UserId | null,
  ) {}
}
