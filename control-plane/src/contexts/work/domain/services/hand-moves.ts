import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import {
  type HeldFor,
  type HoldViewer,
  HoldRights,
} from '@work/domain/services/hold-rights';
import type { MoveDenial } from '@work/domain/value-objects/line-denial';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface HandMovedTask {
  readonly stationId: StationId;
  readonly hold: HeldFor | null;
}

export const HAND_MOVE_DENIALS = [
  'out-of-completed',
  'between-work-stations',
  'on-hold',
] as const satisfies readonly (MoveDenial | 'on-hold')[];

export type HandMoveDenial = (typeof HAND_MOVE_DENIALS)[number];

export interface HandMove {
  readonly to: Station;
  readonly denial: HandMoveDenial | null;
  readonly skips: readonly Station[];
}

const denialOf = (
  task: HandMovedTask,
  line: LineMap,
  from: Station,
  to: Station,
  viewer: HoldViewer,
): HandMoveDenial | null => {
  if (from.id.equals(to.id)) {
    return null;
  }
  if (task.hold && !HoldRights.ends(task.hold, viewer)) {
    return 'on-hold';
  }
  return line.moveDenial(from, to);
};

export const HandMoves = {
  of(
    task: HandMovedTask,
    line: LineMap | null,
    viewer: HoldViewer,
  ): readonly HandMove[] {
    const from = line?.stationAt(task.stationId) ?? null;

    if (!line || !from) {
      return [];
    }

    return line.stations.map((to) => {
      const denial = denialOf(task, line, from, to, viewer);

      return {
        to,
        denial,
        skips: denial ? [] : line.skips(from, to),
      };
    });
  },
};
