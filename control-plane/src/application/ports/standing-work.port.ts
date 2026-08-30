import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { StationId } from '@domain/value-objects/station-id.vo';

export const STANDING_WORK = Symbol('STANDING_WORK');

/** A task standing at a station that can work it should be running. */
export interface StandingWorkPort {
  takeUp(input: { line: AssemblyLine; stationId: StationId }): Promise<void>;
}
