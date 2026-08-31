import type { Station } from '@domain/entities/station.entity';
import { HandoverOption } from '@domain/value-objects/handover-option.vo';

/** The runner is handed the same list, and refuses any word not on it. */
export const handoverOptions = (
  from: Station | null,
  stations: readonly Station[],
): HandoverOption[] => [
  ...stations
    // Nobody works it, so nothing can be handed to it.
    .filter((station) => station.harness)
    .filter((station) => from?.wayOut.leadsTo(station.id))
    .map((station) => HandoverOption.station(station.name)),
  // A person is always reachable; ending the line is laid out for.
  HandoverOption.review(),
  ...(from?.wayOut.ends ? [HandoverOption.done()] : []),
];
