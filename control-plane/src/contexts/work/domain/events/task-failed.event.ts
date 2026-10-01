import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';

export class TaskFailed implements DomainEvent {
  readonly kind = 'task.failed';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly stationId: StationId,
    readonly failure: TaskFailure,
    readonly by: RunId | null,
    readonly at: Date,
  ) {}
}
