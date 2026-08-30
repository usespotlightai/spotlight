import type { Station } from '@domain/entities/station.entity';
import { REVIEW } from '@domain/value-objects/declaration.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

/**
 * Any station but its own, or a person. The runner is handed the same list, so
 * a word that is not on it is refused while the agent can still put it right.
 * Its own is left off: handing a task back where it stands is a loop.
 */
export const handoverOptions = (
  stations: readonly Station[],
  standingAt?: StationId,
): string[] => [
  ...stations
    .filter((station) => !standingAt || !station.id.equals(standingAt))
    .map((station) => station.name.value),
  REVIEW,
];
