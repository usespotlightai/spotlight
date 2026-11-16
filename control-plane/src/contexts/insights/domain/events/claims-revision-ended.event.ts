import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { RevisionOutcomeKind } from '@insights/domain/value-objects/revision-outcome.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ClaimsRevisionEnded implements DomainEvent {
  readonly kind = 'claims-revision.ended';

  constructor(
    readonly revisionId: ClaimsRevisionId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly outcome: RevisionOutcomeKind,
  ) {}
}
