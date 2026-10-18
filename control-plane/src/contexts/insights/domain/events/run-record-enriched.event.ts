import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunRecordEnriched implements DomainEvent {
  readonly kind = 'run-record.enriched';

  constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly location: RunLocation,
  ) {}
}
