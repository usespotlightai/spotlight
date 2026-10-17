import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class TaskPassed implements DomainEvent {
  readonly kind = 'task.passed';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly runId: RunId,
    readonly from: StationId,
    readonly to: StationId,
    readonly at: Date,
  ) {}
}
