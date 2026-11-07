import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const STATION_HOLDERS = Symbol('STATION_HOLDERS');

export type StationRelease = 'released' | 'held';

export interface HeldStation {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: 'backlog' | 'work' | 'completed';
  readonly color: string;
  readonly position: number;
}

export interface HeldLine {
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stations: readonly HeldStation[];
}

export interface StationHoldersPort {
  hold(line: HeldLine): Promise<void>;

  lockedTaskCountsAt(
    stationIds: readonly StationId[],
  ): Promise<ReadonlyMap<string, number>>;

  release(stationIds: readonly StationId[]): Promise<StationRelease>;
}
