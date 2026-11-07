import {
  between,
  NO_SPREAD,
  type Spread,
  spreadOf,
} from '@insights/domain/services/measures';
import type { StationLocation } from '@insights/domain/services/station-ranking';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import {
  type InsightsPeriod,
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

interface StationWithin extends StationLocation {
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
  readonly tasksChange: Delta | null;
}

interface DeliveryDeltas {
  readonly opened: Delta | null;
  readonly reviewed: Delta | null;
  readonly merged: Delta | null;
}

interface DeliveryFlow extends DeliveryWithin {
  readonly changes: DeliveryDeltas;
}

export interface Flow {
  readonly stations: readonly StationFlow[];
  readonly delivery: DeliveryFlow;
}

export interface StationRunCounts extends StationLocation {
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
        tasksChange: deltaOf(station.tasks, was, {
          better: 'neither',
          unit: 'percent',
        }),
      };
    }),
    delivery: {
      ...now.delivery,
      changes: {
        opened: deltaOf(
          now.delivery.opened,
          before.delivery.opened,
          risingIsBetter,
        ),
        reviewed: deltaOf(
          now.delivery.reviewed,
          before.delivery.reviewed,
          risingIsBetter,
        ),
        merged: deltaOf(
          now.delivery.merged,
          before.delivery.merged,
          risingIsBetter,
        ),
      },
    },
  };
};
