import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationSearchScheduleDeletionRequested implements DomainEvent {
  readonly kind = 'replays.station-search-schedule-deletion-requested';

  constructor(
    readonly stationId: string,
    readonly workspaceId: WorkspaceId,
  ) {}
}
