import type { ChatRecord } from '@insights/domain/aggregates/chat-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { inEndOrder } from '@insights/domain/services/run-order';
import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

export interface TeamHistory {
  readonly records: readonly RunRecord[];
  readonly taskPullRequests: readonly TaskPullRequest[];
  readonly taskHumanActions: readonly TaskHumanActions[];
  readonly failures: readonly TaskFailures[];
  readonly chats: readonly ChatRecord[];
}

export interface StationLocation {
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

export const startedWithin = (
  records: readonly RunRecord[],
  window: Window,
): readonly RunRecord[] =>
  records.filter((each) => within(window, each.end?.beganAt ?? null));

export const atStation = (
  records: readonly RunRecord[],
  stationId: string,
): readonly RunRecord[] =>
  records.filter((each) => each.end?.location.stationId === stationId);

export const stationsOf = (
  records: readonly RunRecord[],
): readonly StationLocation[] => {
  const seen = new Map<string, StationLocation>();

  for (const record of [...records].sort(inEndOrder)) {
    const location = record.end?.location;

    if (location && !seen.has(location.stationId)) {
      seen.set(location.stationId, {
        lineId: location.lineId,
        stationId: location.stationId,
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
  humanActions: readonly TaskHumanActions[],
): ReadonlyMap<string, TaskHumanActions> =>
  new Map(humanActions.map((each) => [each.taskId.value, each]));
