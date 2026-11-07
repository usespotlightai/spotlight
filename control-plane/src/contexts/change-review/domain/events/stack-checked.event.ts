import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StackChecked implements DomainEvent {
  readonly kind = 'stack-check.checked';

  constructor(
    readonly checkId: StackCheckId,
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly workspaceId: WorkspaceId,
    readonly passed: boolean | null,
    readonly trial: boolean,
  ) {}
}
