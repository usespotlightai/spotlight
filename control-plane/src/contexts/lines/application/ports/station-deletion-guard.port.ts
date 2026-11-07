import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const STATION_DELETION_GUARD = Symbol('STATION_DELETION_GUARD');

export interface StationTaskCount {
  readonly stationId: StationId;
  readonly tasks: number;
}

export interface LineSave {
  readonly lineId: LineId;
  readonly version: number;
}

export interface StationDeletionGuardPort {
  lockedTaskCountsAt(
    save: LineSave,
    stationIds: readonly StationId[],
  ): Promise<readonly StationTaskCount[]>;

  release(stationIds: readonly StationId[]): Promise<void>;
}
