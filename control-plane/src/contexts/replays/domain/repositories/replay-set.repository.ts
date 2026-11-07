import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplaySetRepository {
  find(id: ReplaySetId): Promise<ReplaySet | null>;

  findMany(ids: readonly ReplaySetId[]): Promise<readonly ReplaySet[]>;

  locked(id: ReplaySetId): Promise<ReplaySet | null>;

  ofLine(lineId: LineId): Promise<readonly ReplaySet[]>;

  ofStation(stationId: StationId): Promise<ReplaySet | null>;

  atLiveStationsRefreshedBefore(at: Date): Promise<readonly ReplaySet[]>;

  add(set: ReplaySet): Promise<void>;

  save(set: ReplaySet): Promise<void>;

  ofTeam(teamId: TeamId): Promise<readonly ReplaySet[]>;
}
