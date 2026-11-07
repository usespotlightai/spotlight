import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const STATION_DELETION_GUARD = Symbol('STATION_DELETION_GUARD');

export type StationRelease = 'released' | 'occupied';

export interface StationDeletionGuardPort {
  lockedTaskCountsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>>;

  release(stationIds: readonly StationId[]): Promise<StationRelease>;
}
