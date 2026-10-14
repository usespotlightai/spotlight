import type { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import type { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import {
  inEndOrder,
  inStartOrder,
  startOf,
} from '@outcomes/domain/services/run-order';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

export interface TeamHistory {
  readonly records: readonly RunRecord[];
  readonly deliveries: readonly TaskDelivery[];
  readonly touches: readonly TaskTouches[];
  readonly failures: readonly TaskFailures[];
  readonly chats: readonly ChatRecord[];
}

export interface StationPlace {
  readonly lineId: string;
  readonly stationId: string;
}

export const endedWithin = (
  records: readonly RunRecord[],
  window: Window,
): readonly RunRecord[] =>
  records
    .filter((each) => within(window, each.end?.endedAt ?? null))
    .sort(inEndOrder);

export interface StartedHistory {
  readonly records: readonly RunRecord[];
  readonly runsFrom: Date;
}

export const latestStarted = (
  records: readonly RunRecord[],
  most: number,
  from: Date,
): StartedHistory => {
  const inOrder = [...records].sort((one, other) =>
    inStartOrder(startOf(one), startOf(other)),
  );
  const lastLeftOut = inOrder[inOrder.length - most - 1];

  if (!lastLeftOut) {
    return { records, runsFrom: from };
  }

  const cut = startOf(lastLeftOut).beganAt.getTime();
  const kept = inOrder.filter((each) => startOf(each).beganAt.getTime() > cut);
  const held = new Set(kept);
  const firstKept = kept[0] ? startOf(kept[0]).beganAt.getTime() : cut + 1;

  return {
    records: records.filter((each) => held.has(each)),
    runsFrom: new Date(Math.max(from.getTime(), firstKept)),
  };
};

export const startedWithin = (
  records: readonly RunRecord[],
  window: Window,
): readonly RunRecord[] =>
  records.filter((each) => within(window, each.end?.beganAt ?? null));

export const atStation = (
  records: readonly RunRecord[],
  stationId: string,
): readonly RunRecord[] =>
  records.filter((each) => each.end?.place.stationId === stationId);

export const stationsOf = (
  records: readonly RunRecord[],
): readonly StationPlace[] => {
  const seen = new Map<string, StationPlace>();

  for (const record of [...records].sort(inEndOrder)) {
    const place = record.end?.place;

    if (place && !seen.has(place.stationId)) {
      seen.set(place.stationId, {
        lineId: place.lineId,
        stationId: place.stationId,
      });
    }
  }

  return [...seen.values()];
};

export const tasksOf = (records: readonly RunRecord[]): readonly string[] => [
  ...new Set(
    records.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
  ),
];

export const openingsOf = (
  touches: readonly TaskTouches[],
): ReadonlyMap<string, TaskTouches> =>
  new Map(touches.map((each) => [each.taskId.value, each]));
