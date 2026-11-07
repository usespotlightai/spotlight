import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DispatchOrdered implements DomainEvent {
  readonly kind = 'dispatch.ordered';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
