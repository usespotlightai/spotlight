import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ClaimsSourceRecorded implements DomainEvent {
  readonly kind = 'claims-source.recorded';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly rubricVersion: RubricVersion,
  ) {}
}
