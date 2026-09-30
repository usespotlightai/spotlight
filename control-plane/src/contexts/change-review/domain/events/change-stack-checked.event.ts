import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ChangeStackChecked implements DomainEvent {
  readonly kind = 'change-stack.checked';

  constructor(
    readonly stackId: ChangeStackId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly workspaceId: WorkspaceId,
    readonly passed: boolean | null,
  ) {}
}
