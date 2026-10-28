import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { RefreshCutoff } from '@replays/domain/services/kept-set-refresh';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ReplaySetRepository {
  find(id: ReplaySetId): Promise<ReplaySet | null>;

  findMany(ids: readonly ReplaySetId[]): Promise<readonly ReplaySet[]>;

  locked(id: ReplaySetId): Promise<ReplaySet | null>;

  ofLine(lineId: string): Promise<readonly ReplaySet[]>;

  ofStation(stationId: string): Promise<ReplaySet | null>;

  dueForRefresh(
    cutoff: RefreshCutoff,
    limit: number,
  ): Promise<readonly ReplaySet[]>;

  add(set: ReplaySet): Promise<void>;

  save(set: ReplaySet): Promise<void>;

  ofTeam(teamId: TeamId): Promise<readonly ReplaySet[]>;
}
