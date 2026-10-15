import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  failuresWithin,
  type LocatedFailure,
  mostRunsFirst,
  type RunFailureSummary,
  runFailureSummaries,
  type TaskFailureSummary,
  taskFailureSummaries,
} from '@outcomes/domain/services/failure-summaries';
import {
  NO_RUNS,
  type RunTally,
  runTally,
  type TallyChanges,
  type TallyCounts,
  type TallySeen,
  tallyChangesOf,
  tallyOf,
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
  type Window,
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

export interface WindowCounts {
  readonly current: TallyCounts;
  readonly previous: TallyCounts;
  readonly byDay: ReadonlyMap<string, TallyCounts>;
}

export interface StationCounts extends StationPlace, WindowCounts {
  readonly runFailures: readonly RunFailureSummary[];
}

export interface FailingTask extends LocatedFailure {
  readonly lineId: string | null;
}

export interface TeamCounts {
  readonly team: WindowCounts;
  readonly stations: readonly StationCounts[];
  readonly failing: readonly FailingTask[];
}

const countsOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): TallyCounts => {
  const { failedShare, ...counts } = runTally(records, deliveries);

  return counts;
};

const windowCountsOf = (
  current: readonly RunRecord[],
  previous: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): WindowCounts => {
  const byDay = new Map<string, RunRecord[]>();

  for (const record of current) {
    if (record.end) {
      const day = dayOf(record.end.endedAt);
      byDay.set(day, [...(byDay.get(day) ?? []), record]);
    }
  }

  return {
    current: countsOf(current, deliveries),
    previous: countsOf(previous, deliveries),
    byDay: new Map(
      [...byDay].map(([day, records]) => [day, countsOf(records, deliveries)]),
    ),
  };
};

export const failingTasksOf = (
  history: TeamHistory,
  window: Window,
): readonly FailingTask[] => {
  const openings = openingsOf(history.touches);

  return failuresWithin(history.failures, window).map((each) => ({
    ...each,
    lineId: openings.get(each.taskId)?.opening?.lineId ?? null,
  }));
};

export const teamCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): TeamCounts => {
  const current = endedWithin(history.records, period.current);
  const previous = endedWithin(history.records, period.previous);

  return {
    team: windowCountsOf(current, previous, history.deliveries),
    stations: stationsOf(current).map((place) => {
      const here = atStation(current, place.stationId);

      return {
        ...place,
        ...windowCountsOf(
          here,
          atStation(previous, place.stationId),
          history.deliveries,
        ),
        runFailures: runFailureSummaries(here),
      };
    }),
    failing: failingTasksOf(history, period.current),
  };
};

const NO_STATION_COUNTS: WindowCounts = {
  current: NO_RUNS,
  previous: NO_RUNS,
  byDay: new Map(),
};

const reportFrom = (
  counts: WindowCounts,
  days: readonly string[],
): TallyReport => {
  const tally = tallyOf(counts.current);
  const before = tallyOf(counts.previous);

  return {
    tally,
    changes: tallyChangesOf(tally, before),
    seen: tallySeenOf(tally, before),
    trend: days.map((day) => ({
      day,
      tally: tallyOf(counts.byDay.get(day) ?? NO_RUNS),
    })),
  };
};

export const teamReportFrom = (
  counts: TeamCounts,
  period: InsightsPeriod,
): TallyReport => reportFrom(counts.team, period.days);

export const stationReportsFrom = (
  counts: TeamCounts,
  period: InsightsPeriod,
): readonly StationReport[] => {
  const places = new Map<string, StationCounts>(
    counts.stations.map((each) => [each.stationId, each]),
  );

  for (const each of counts.failing) {
    const stationId = each.occurrence.stationId;

    if (!places.has(stationId) && each.lineId) {
      places.set(stationId, {
        lineId: each.lineId,
        stationId,
        ...NO_STATION_COUNTS,
        runFailures: [],
      });
    }
  }

  return [...places.values()].map((station) => ({
    lineId: station.lineId,
    stationId: station.stationId,
    ...reportFrom(station, period.days),
    taskFailures: taskFailureSummaries(
      counts.failing.filter(
        (each) => each.occurrence.stationId === station.stationId,
      ),
    ),
    runFailures: mostRunsFirst(station.runFailures),
  }));
};
