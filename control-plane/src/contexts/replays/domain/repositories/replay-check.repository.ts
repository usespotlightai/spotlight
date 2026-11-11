import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { CheckedChange } from '@replays/domain/value-objects/checked-change.vo';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayCheckRepository {
  find(id: ReplayCheckId): Promise<ReplayCheck | null>;

  ofChange(
    stationId: StationId,
    change: CheckedChange,
  ): Promise<readonly ReplayCheck[]>;

  awaitingBaseline(): Promise<readonly ReplayCheck[]>;

  awaitingBaselineOfSet(setId: ReplaySetId): Promise<readonly ReplayCheck[]>;

  ofTeam(teamId: TeamId): Promise<readonly ReplayCheck[]>;

  ofSet(setId: ReplaySetId): Promise<readonly ReplayCheck[]>;

  add(check: ReplayCheck): Promise<void>;

  save(check: ReplayCheck): Promise<void>;
}
