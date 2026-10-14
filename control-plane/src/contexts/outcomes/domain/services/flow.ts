import type {
  InboxWait,
  TaskTouches,
} from '@outcomes/domain/aggregates/task-touches.aggregate';
import {
  between,
  known,
  type Spread,
  spreadOf,
} from '@outcomes/domain/services/measures';
import {
  atStation,
  endedWithin,
  type StationPlace,
  stationsOf,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';
import {
  type InsightsPeriod,
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

interface StationWithin extends StationPlace {
  readonly tasks: number;
  readonly taskIds: readonly string[];
  readonly runs: number;
  readonly queued: Spread;
  readonly running: Spread;
  readonly inbox: Spread;
  readonly asks: number;
  readonly unanswered: number;
}

interface DeliveryWithin {
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

interface FlowWithin {
  readonly stations: readonly StationWithin[];
  readonly delivery: DeliveryWithin;
}

interface StationFlow extends StationWithin {
  readonly tasksBefore: number;
  readonly tasksChange: Change | null;
}

interface DeliveryChanges {
  readonly opened: Change | null;
  readonly reviewed: Change | null;
  readonly merged: Change | null;
}

interface DeliveryFlow extends DeliveryWithin {
  readonly changes: DeliveryChanges;
}

export interface Flow {
  readonly stations: readonly StationFlow[];
  readonly delivery: DeliveryFlow;
}

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

export interface StationRunCounts extends StationPlace {
  readonly taskIds: readonly string[];
  readonly runs: number;
  readonly queued: Spread;
  readonly running: Spread;
}

export interface StationInboxCounts {
  readonly stationId: string;
  readonly asks: number;
  readonly unanswered: number;
  readonly inbox: Spread;
}

export interface FlowWindowCounts {
  readonly stations: readonly StationRunCounts[];
  readonly inbox: readonly StationInboxCounts[];
}

export interface DeliveryMoments {
  readonly taskId: string;
  readonly openedAt: Date;
  readonly firstReviewAt: Date | null;
  readonly closedAt: Date | null;
  readonly merged: boolean;
  readonly taskOpenedAt: Date | null;
}

export interface FlowCounts {
  readonly current: FlowWindowCounts;
  readonly previous: FlowWindowCounts;
  readonly deliveries: readonly DeliveryMoments[];
}

const windowCountsOf = (
  history: TeamHistory,
  window: Window,
): FlowWindowCounts => {
  const ended = endedWithin(history.records, window);
  const waits = inboxWaitsWithin(history, window);
  const asked = new Map<string, (InboxWait & { readonly taskId: string })[]>();

  for (const wait of waits) {
    const here = asked.get(wait.stationId) ?? [];
    here.push(wait);
    asked.set(wait.stationId, here);
  }

  return {
    stations: stationsOf(ended).map((place) => {
      const here = atStation(ended, place.stationId).filter((each) => each.ran);

      return {
        ...place,
        taskIds: tasksOf(here),
        runs: here.length,
        queued: spreadOf(known(here.map((each) => each.end?.queuedMs ?? null))),
        running: spreadOf(
          known(here.map((each) => each.end?.runningMs ?? null)),
        ),
      };
    }),
    inbox: [...asked.entries()].map(([stationId, here]) => ({
      stationId,
      asks: here.length,
      unanswered: here.filter((each) => each.answeredAt === null).length,
      inbox: spreadOf(known(here.map(answerMs))),
    })),
  };
};

const touchedWithin = (each: DeliveryMoments, window: Window): boolean =>
  within(window, each.openedAt) ||
  within(window, each.firstReviewAt) ||
  (each.merged && within(window, each.closedAt));

export const flowCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  openings: ReadonlyMap<string, TaskTouches>,
): FlowCounts => ({
  current: windowCountsOf(history, period.current),
  previous: windowCountsOf(history, period.previous),
  deliveries: history.deliveries
    .map((each) => ({
      taskId: each.taskId.value,
      openedAt: each.openedAt,
      firstReviewAt: each.firstReviewAt,
      closedAt: each.closedAt,
      merged: each.merged,
      taskOpenedAt: openings.get(each.taskId.value)?.opening?.at ?? null,
    }))
    .filter(
      (each) =>
        touchedWithin(each, period.current) ||
        touchedWithin(each, period.previous),
    ),
});

const NO_SPREAD: Spread = spreadOf([]);

const flowWithin = (
  counts: FlowWindowCounts,
  deliveries: readonly DeliveryMoments[],
  window: Window,
): FlowWithin => {
  const inbox = new Map(counts.inbox.map((each) => [each.stationId, each]));
  const opened = deliveries.filter((each) => within(window, each.openedAt));
  const reviewed = deliveries.filter((each) =>
    within(window, each.firstReviewAt),
  );
  const merged = deliveries.filter(
    (each) => each.merged && within(window, each.closedAt),
  );

  return {
    stations: counts.stations.map((station) => {
      const asked = inbox.get(station.stationId);

      return {
        lineId: station.lineId,
        stationId: station.stationId,
        tasks: station.taskIds.length,
        taskIds: station.taskIds,
        runs: station.runs,
        queued: station.queued,
        running: station.running,
        inbox: asked?.inbox ?? NO_SPREAD,
        asks: asked?.asks ?? 0,
        unanswered: asked?.unanswered ?? 0,
      };
    }),
    delivery: {
      toPullRequest: spreadOf(
        opened.flatMap((each) =>
          each.taskOpenedAt ? [between(each.taskOpenedAt, each.openedAt)] : [],
        ),
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
      openedTaskIds: opened.map((each) => each.taskId),
      reviewedTaskIds: reviewed.map((each) => each.taskId),
      mergedTaskIds: merged.map((each) => each.taskId),
    },
  };
};

const risingIsBetter = { better: 'up', unit: 'percent' } as const;

export const flowFrom = (counts: FlowCounts, period: InsightsPeriod): Flow => {
  const now = flowWithin(counts.current, counts.deliveries, period.current);
  const before = flowWithin(
    counts.previous,
    counts.deliveries,
    period.previous,
  );
  const tasksBefore = new Map(
    before.stations.map((each) => [each.stationId, each.tasks]),
  );

  return {
    stations: now.stations.map((station) => {
      const was = tasksBefore.get(station.stationId) ?? 0;

      return {
        ...station,
        tasksBefore: was,
        tasksChange: changeOf(station.tasks, was, {
          better: 'neither',
          unit: 'percent',
        }),
      };
    }),
    delivery: {
      ...now.delivery,
      changes: {
        opened: changeOf(
          now.delivery.opened,
          before.delivery.opened,
          risingIsBetter,
        ),
        reviewed: changeOf(
          now.delivery.reviewed,
          before.delivery.reviewed,
          risingIsBetter,
        ),
        merged: changeOf(
          now.delivery.merged,
          before.delivery.merged,
          risingIsBetter,
        ),
      },
    },
  };
};
