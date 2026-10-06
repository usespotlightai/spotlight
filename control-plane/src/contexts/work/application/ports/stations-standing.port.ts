export const STATIONS_STANDING = Symbol('STATIONS_STANDING');

export interface StationsStandingPort {
  among(stationIds: readonly string[]): Promise<readonly string[]>;
}
