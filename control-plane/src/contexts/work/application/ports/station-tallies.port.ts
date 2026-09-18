import type { StationId } from '@work/domain/value-objects/station-id.vo';

export const STATION_TALLIES = Symbol('STATION_TALLIES');

export interface StationTalliesPort {
  standingAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>>;

  lockedStandingAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>>;
}
