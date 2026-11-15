import type { RevisionTrigger } from '@insights/domain/services/revision-trigger';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ClaimsRevisionStarted implements DomainEvent {
  readonly kind = 'claims-revision.started';

  constructor(
    readonly revisionId: ClaimsRevisionId,
    readonly workspaceId: WorkspaceId,
    readonly stationId: StationId,
    readonly rubricVersion: RubricVersion,
    readonly trigger: RevisionTrigger,
  ) {}
}
