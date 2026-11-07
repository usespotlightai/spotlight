import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface MovedBetween {
  readonly id: StationId;
  readonly key: StationKey;
}

export class TaskMoved implements DomainEvent {
  readonly kind = 'task.moved';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly from: MovedBetween,
    readonly to: MovedBetween,
    readonly at: Date,
  ) {}
}
