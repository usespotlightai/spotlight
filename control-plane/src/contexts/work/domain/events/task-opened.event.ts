import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class TaskOpened implements DomainEvent {
  readonly kind = 'task.opened';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly heard: boolean,
    readonly proposedIn: ProposalOrigin | null = null,
  ) {}
}
