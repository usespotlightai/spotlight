import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import type { PersonAct } from '@work/domain/value-objects/person-act';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class TaskActedOn implements DomainEvent {
  readonly kind = 'task.acted-on';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly act: PersonAct,
    readonly by: UserId,
    readonly after: RunId | null,
    readonly at: Date,
    readonly tool: CalledTool | null = null,
    readonly forApproval: boolean = false,
  ) {}
}
