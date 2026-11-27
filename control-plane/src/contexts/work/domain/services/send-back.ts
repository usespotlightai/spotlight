import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface SentBackTask {
  readonly stationId: StationId;
  readonly finished: boolean;
}

export const SendBack = {
  allows(task: SentBackTask, line: LineMap, to: Station): boolean {
    const from = line.stationAt(task.stationId);

    return task.finished && from !== null && line.sendsBack(from, to);
  },

  targets(task: SentBackTask, line: LineMap | null): readonly StationId[] {
    return task.finished && line
      ? line.stations
          .filter((to) => SendBack.allows(task, line, to))
          .map((to) => to.id)
      : [];
  },
};
