import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunProvisionFailed implements DomainEvent {
  readonly kind = 'run.provision-failed';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly attempt: number,
    readonly failure: string,
    readonly detail: string,
    readonly at: Date,
  ) {}
}
