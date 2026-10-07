import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  failuresWithin,
  type RunFailureSummary,
  runFailureSummaries,
  type TaskFailureSummary,
  taskFailureSummaries,
} from '@outcomes/domain/services/failure-summaries';
import {
  type RunTally,
  runTally,
  type TallyChanges,
  type TallySeen,
  tallyChangesOf,
  tallySeenOf,
} from '@outcomes/domain/services/run-tally';
import {
  atStation,
  endedWithin,
  openingsOf,
  type StationPlace,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  dayOf,
  type InsightsPeriod,
} from '@outcomes/domain/value-objects/insights-period.vo';

export interface DayTally {
  readonly day: string;
  readonly tally: RunTally;
}

export interface TallyReport {
  readonly tally: RunTally;
  readonly changes: TallyChanges;
  readonly seen: TallySeen;
  readonly trend: readonly DayTally[];
}

export interface StationReport extends StationPlace, TallyReport {
  readonly taskFailures: readonly TaskFailureSummary[];
  readonly runFailures: readonly RunFailureSummary[];
}

const tallyReportOf = (
  current: readonly RunRecord[],
  previous: readonly RunRecord[],
  days: readonly string[],
  deliveries: readonly TaskDelivery[],
): TallyReport => {
  const tally = runTally(current, deliveries);
  const before = runTally(previous, deliveries);

  return {
    tally,
    changes: tallyChangesOf(tally, before),
    seen: tallySeenOf(tally, before),
    trend: days.map((day) => ({
      day,
      tally: runTally(
        current.filter((each) => each.end && dayOf(each.end.endedAt) === day),
        deliveries,
      ),
    })),
  };
};

export const teamReportOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): TallyReport =>
  tallyReportOf(
    endedWithin(history.records, period.current),
    endedWithin(history.records, period.previous),
    period.days,
    history.deliveries,
  );

export const stationReportsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): readonly StationReport[] => {
  const current = endedWithin(history.records, period.current);
  const previous = endedWithin(history.records, period.previous);
  const failing = failuresWithin(history.failures, period.current);
  const places = new Map(
    stationsOf(current).map((each) => [each.stationId, each]),
  );

  const openings = openingsOf(history.touches);

  for (const each of failing) {
    const stationId = each.occurrence.stationId;
    const lineId = openings.get(each.taskId)?.opening?.lineId;

    if (!places.has(stationId) && lineId) {
      places.set(stationId, { lineId, stationId });
    }
  }

  return [...places.values()].map((place) => {
    const here = atStation(current, place.stationId);

    return {
      ...place,
      ...tallyReportOf(
        here,
        atStation(previous, place.stationId),
        period.days,
        history.deliveries,
      ),
      taskFailures: taskFailureSummaries(
        failing.filter((each) => each.occurrence.stationId === place.stationId),
      ),
      runFailures: runFailureSummaries(here),
    };
  });
};
