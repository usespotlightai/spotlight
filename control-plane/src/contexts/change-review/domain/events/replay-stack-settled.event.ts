import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReplayStackSettled implements DomainEvent {
  readonly kind = 'change-stack.replay-settled';

  constructor(
    readonly stackId: ChangeStackId,
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
