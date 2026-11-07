import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface SearchRepository {
  find(id: SearchId): Promise<Search | null>;

  locked(id: SearchId): Promise<Search | null>;

  findMany(ids: readonly SearchId[]): Promise<readonly Search[]>;

  ofLineStartedSince(lineId: LineId, since: Date): Promise<readonly Search[]>;

  ranAs(run: RunId): Promise<Search | null>;

  activeAtStation(stationId: StationId): Promise<Search | null>;

  activeOfLine(lineId: LineId): Promise<readonly Search[]>;

  newestAtStation(stationId: StationId): Promise<Search | null>;

  activeOfSet(setId: ReplaySetId): Promise<Search | null>;

  ofStation(stationId: StationId): Promise<readonly Search[]>;

  ofTeam(teamId: TeamId): Promise<readonly Search[]>;

  advancing(): Promise<readonly Search[]>;

  add(search: Search): Promise<void>;

  save(search: Search): Promise<void>;
}
