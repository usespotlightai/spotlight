import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { StationId } from '@domain/value-objects/station-id.vo';

export const STANDING_WORK = Symbol('STANDING_WORK');

export interface StandingWork {
  takeUp(input: { line: AssemblyLine; stationId: StationId }): Promise<void>;
}
