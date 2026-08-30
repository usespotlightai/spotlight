import type { Station } from '@domain/entities/station.entity';
import { REVIEW } from '@domain/value-objects/declaration.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

/** The runner is handed the same list, and refuses any word not on it. */
export const handoverOptions = (
  stations: readonly Station[],
  standingAt?: StationId,
): string[] => [
  ...stations
    .filter((station) => station.harness)
    .filter((station) => !standingAt || !station.id.equals(standingAt))
    .map((station) => station.name.value),
  REVIEW,
];
