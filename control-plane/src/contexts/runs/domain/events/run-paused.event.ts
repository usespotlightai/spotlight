import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunPaused implements DomainEvent {
  readonly kind = 'run.paused';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly attempt: number,
    readonly at: Date,
    readonly resumesAtOnce: boolean,
  ) {}
}
