import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface StationSearchScheduleRepository {
  ofStation(stationId: string): Promise<StationSearchSchedule | null>;

  locked(stationId: string): Promise<StationSearchSchedule | null>;

  ofSet(setId: ReplaySetId): Promise<StationSearchSchedule | null>;

  dueStations(now: Date, limit: number): Promise<readonly string[]>;

  ofLine(lineId: string): Promise<readonly StationSearchSchedule[]>;

  ofTeam(teamId: TeamId): Promise<readonly StationSearchSchedule[]>;

  add(schedule: StationSearchSchedule): Promise<void>;

  save(schedule: StationSearchSchedule): Promise<void>;
}
