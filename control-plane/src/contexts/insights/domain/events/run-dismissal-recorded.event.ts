import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunDismissalRecorded implements DomainEvent {
  readonly kind = 'run-record.dismissal-recorded';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
