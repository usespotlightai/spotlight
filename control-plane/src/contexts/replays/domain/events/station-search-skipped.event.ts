import type { SearchSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class StationSearchSkipped implements DomainEvent {
  readonly kind = 'station-search-schedule.skipped';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly reason: SearchSkipReason,
    readonly at: Date,
  ) {}
}
