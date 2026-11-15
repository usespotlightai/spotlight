import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ClaimsRevisionPicked implements DomainEvent {
  readonly kind = 'claims-revision.picked';

  constructor(
    readonly revisionId: ClaimsRevisionId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
  ) {}
}
