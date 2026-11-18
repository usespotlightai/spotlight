import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HoldId } from '@work/domain/value-objects/hold-id.vo';

export class TaskHeld implements DomainEvent {
  readonly kind = 'task.held';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly holdId: HoldId,
    readonly stationId: StationId,
    readonly by: UserId,
    readonly from: RunId | null,
    readonly at: Date,
  ) {}
}
