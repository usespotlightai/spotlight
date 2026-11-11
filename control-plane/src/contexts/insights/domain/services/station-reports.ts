import {
  type LocatedFailure,
  mostRunsFirst,
  type RunFailureSummary,
  type TaskFailureSummary,
  taskFailureSummaries,
} from '@insights/domain/services/failure-summaries';
import {
  NO_RUNS,
  type RunTally,
  type TallyCounts,
  type TallyDeltas,
  type TallySeen,
  tallyDeltasOf,
  tallyOf,
  tallySeenOf,
} from '@insights/domain/services/run-tally';
import type { StationLocation } from '@insights/domain/services/station-ranking';
import { type InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';

export interface DayTally {
  readonly day: string;
  readonly tally: RunTally;
}

export interface TallyReport {
  readonly tally: RunTally;
  readonly changes: TallyDeltas;
  readonly seen: TallySeen;
  readonly trend: readonly DayTally[];
}

export interface StationReport extends StationLocation, TallyReport {
  readonly taskFailures: readonly TaskFailureSummary[];
  readonly runFailures: readonly RunFailureSummary[];
}

export interface WindowCounts {
  readonly current: TallyCounts;
  readonly previous: TallyCounts;
  readonly byDay: ReadonlyMap<string, TallyCounts>;
}

export interface StationCounts extends StationLocation, WindowCounts {
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
    changes: tallyDeltasOf(tally, before),
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
    const stationId = each.occurrence.stationId.value;

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
        (each) => each.occurrence.stationId.value === station.stationId,
      ),
    ),
    runFailures: mostRunsFirst(station.runFailures),
  }));
};
