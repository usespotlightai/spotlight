import type { Station } from '@domain/entities/station.entity';

export const STANDING_WORK = Symbol('STANDING_WORK');

/**
 * A task standing at a station that can work it should be running. Every way a
 * task or a station changes ends here, so the rule is stated once.
 */
export interface StandingWorkPort {
  takeUp(input: {
    station: Station;
    stations: readonly Station[];
  }): Promise<void>;
}
