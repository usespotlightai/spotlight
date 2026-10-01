import type { InboxWait } from '@outcomes/domain/aggregates/task-touches.aggregate';
import {
  between,
  type Spread,
  spreadOf,
} from '@outcomes/domain/services/measures';
import {
  atStation,
  endedWithin,
  openingsOf,
  type StationPlace,
  stationsOf,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import {
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

interface StationFlow extends StationPlace {
  readonly tasks: number;
  readonly taskIds: readonly string[];
  readonly runs: number;
  readonly queued: Spread;
  readonly running: Spread;
  readonly inbox: Spread;
  readonly asks: number;
  readonly unanswered: number;
}

interface DeliveryFlow {
  readonly toPullRequest: Spread;
  readonly toFirstReview: Spread;
  readonly toMerge: Spread;
  readonly opened: number;
  readonly reviewed: number;
  readonly merged: number;
  readonly openedTaskIds: readonly string[];
  readonly reviewedTaskIds: readonly string[];
  readonly mergedTaskIds: readonly string[];
}

export interface Flow {
  readonly stations: readonly StationFlow[];
  readonly delivery: DeliveryFlow;
}

const known = (values: readonly (number | null)[]): number[] =>
  values.flatMap((each) => (each === null ? [] : [each]));

export const inboxWaitsWithin = (
  history: TeamHistory,
  window: Window,
): readonly (InboxWait & { readonly taskId: string })[] =>
  history.touches.flatMap((touches) =>
    touches
      .waits()
      .filter((wait) => within(window, wait.askedAt))
      .map((wait) => ({ ...wait, taskId: touches.taskId.value })),
  );

const answerMs = (wait: InboxWait): number | null =>
  wait.answeredAt ? between(wait.askedAt, wait.answeredAt) : null;

export const flowOf = (history: TeamHistory, window: Window): Flow => {
  const ended = endedWithin(history.records, window);
  const waits = inboxWaitsWithin(history, window);
  const openings = openingsOf(history.touches);
  const opened = history.deliveries.filter((each) =>
    within(window, each.openedAt),
  );
  const reviewed = history.deliveries.filter((each) =>
    within(window, each.firstReviewAt),
  );
  const merged = history.deliveries.filter(
    (each) => each.merged && within(window, each.closedAt),
  );

  return {
    stations: stationsOf(ended).map((place) => {
      const here = atStation(ended, place.stationId).filter((each) => each.ran);
      const asked = waits.filter((each) => each.stationId === place.stationId);
      const taskIds = tasksOf(here);

      return {
        ...place,
        tasks: taskIds.length,
        taskIds,
        runs: here.length,
        queued: spreadOf(known(here.map((each) => each.end?.queuedMs ?? null))),
        running: spreadOf(
          known(here.map((each) => each.end?.runningMs ?? null)),
        ),
        inbox: spreadOf(known(asked.map(answerMs))),
        asks: asked.length,
        unanswered: asked.filter((each) => each.answeredAt === null).length,
      };
    }),
    delivery: {
      toPullRequest: spreadOf(
        opened.flatMap((each) => {
          const from = openings.get(each.taskId.value)?.opening?.at;
          return from ? [between(from, each.openedAt)] : [];
        }),
      ),
      toFirstReview: spreadOf(
        reviewed.flatMap((each) =>
          each.firstReviewAt
            ? [between(each.openedAt, each.firstReviewAt)]
            : [],
        ),
      ),
      toMerge: spreadOf(
        merged.flatMap((each) => {
          const from = each.firstReviewAt ?? each.openedAt;
          return each.closedAt ? [between(from, each.closedAt)] : [];
        }),
      ),
      opened: opened.length,
      reviewed: reviewed.length,
      merged: merged.length,
      openedTaskIds: opened.map((each) => each.taskId.value),
      reviewedTaskIds: reviewed.map((each) => each.taskId.value),
      mergedTaskIds: merged.map((each) => each.taskId.value),
    },
  };
};
