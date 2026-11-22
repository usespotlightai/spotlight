import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunDriver } from '@work/domain/value-objects/dispatch-subject';

export class TaskAsked implements DomainEvent {
  readonly kind = 'task.asked';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly assignee: UserId | null,
    readonly at: Date,
    readonly by: RunId | null,
    readonly driver: RunDriver,
    readonly runAsked: boolean,
  ) {}
}
