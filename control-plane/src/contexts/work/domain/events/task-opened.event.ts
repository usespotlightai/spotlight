import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';

export class TaskOpened implements DomainEvent {
  readonly kind = 'task.opened';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly createdBy: UserId | null,
    readonly at: Date,
    readonly fromIntegration: boolean,
    readonly proposedIn: ProposalOrigin | null = null,
  ) {}
}
