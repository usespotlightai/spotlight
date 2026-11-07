import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface StationSearchScheduleRepository {
  ofStation(stationId: StationId): Promise<StationSearchSchedule | null>;

  locked(stationId: StationId): Promise<StationSearchSchedule | null>;

  ofSet(setId: ReplaySetId): Promise<StationSearchSchedule | null>;

  dueStations(now: Date, limit: number): Promise<readonly StationId[]>;

  withStepsPendingSince(
    before: Date,
    limit: number,
  ): Promise<readonly StationId[]>;

  ofLine(lineId: LineId): Promise<readonly StationSearchSchedule[]>;

  ofTeam(teamId: TeamId): Promise<readonly StationSearchSchedule[]>;

  add(schedule: StationSearchSchedule): Promise<void>;

  save(schedule: StationSearchSchedule): Promise<void>;
}
