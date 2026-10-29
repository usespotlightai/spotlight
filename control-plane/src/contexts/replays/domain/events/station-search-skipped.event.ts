import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationSearchSkipped implements DomainEvent {
  readonly kind = 'replays.station-search-skipped';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly lineId: string,
    readonly stationId: string,
    readonly reason: SearchSkipReason,
    readonly at: Date,
  ) {}
}
