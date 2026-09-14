import type { Line } from '@domain/aggregates/line.aggregate';
import type { StationId } from '@domain/value-objects/station-id.vo';

export const STANDING_WORK = Symbol('STANDING_WORK');

export interface StandingWork {
  takeUp(input: { line: Line; stationId: StationId }): Promise<void>;
}
