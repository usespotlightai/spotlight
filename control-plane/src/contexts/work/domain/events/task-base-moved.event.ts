import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Branch } from '@work/domain/value-objects/branch.vo';

export class TaskBaseMoved implements DomainEvent {
  readonly kind = 'task.base-moved';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly from: Branch,
    readonly to: Branch | null,
  ) {}
}
