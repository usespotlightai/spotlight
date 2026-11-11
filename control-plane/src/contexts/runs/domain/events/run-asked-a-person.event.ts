import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunAskedAPerson implements DomainEvent {
  readonly kind = 'run.asked-a-person';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly runner: RunnerId,
  ) {}
}
