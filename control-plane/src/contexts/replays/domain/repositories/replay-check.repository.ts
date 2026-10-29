import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplayCheckRepository {
  find(id: ReplayCheckId): Promise<ReplayCheck | null>;

  matching(
    stationId: string,
    candidate: StationHashes,
    live: StationHashes,
  ): Promise<readonly ReplayCheck[]>;

  awaitingBaseline(): Promise<readonly ReplayCheck[]>;

  awaitingBaselineOfSet(setId: ReplaySetId): Promise<readonly ReplayCheck[]>;

  ofTeam(teamId: TeamId): Promise<readonly ReplayCheck[]>;

  ofSet(setId: ReplaySetId): Promise<readonly ReplayCheck[]>;

  add(check: ReplayCheck): Promise<void>;

  save(check: ReplayCheck): Promise<void>;
}
