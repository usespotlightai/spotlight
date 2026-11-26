import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { type PassedOnTask, PassOn } from '@work/domain/services/pass-on';
import type { MoveDenial } from '@work/domain/value-objects/line-denial';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export const MovesByHand = {
  denial(task: PassedOnTask, line: LineMap, to: Station): MoveDenial | null {
    const from = line.stationAt(task.stationId);

    if (!from) {
      throw new UnknownStationError(task.stationId.value);
    }

    return PassOn.allows(task, line, to) ? null : line.moveDenial(from, to);
  },

  targets(task: PassedOnTask, line: LineMap | null): readonly StationId[] {
    return line?.stationAt(task.stationId)
      ? line.stations
          .filter((to) => MovesByHand.denial(task, line, to) === null)
          .map((to) => to.id)
      : [];
  },
};
