import {
  failuresWithin,
  type RunFailureSummary,
  runFailureSummaries,
  type TaskFailureSummary,
  taskFailureSummaries,
} from '@outcomes/domain/services/failure-summaries';
import { type RunTally, runTally } from '@outcomes/domain/services/run-tally';
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

export interface StationReport extends StationPlace {
  readonly tally: RunTally;
  readonly before: RunTally;
  readonly trend: readonly DayTally[];
  readonly taskFailures: readonly TaskFailureSummary[];
  readonly runFailures: readonly RunFailureSummary[];
}

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
      tally: runTally(here, history.deliveries),
      before: runTally(
        atStation(previous, place.stationId),
        history.deliveries,
      ),
      trend: period.days.map((day) => ({
        day,
        tally: runTally(
          here.filter((each) => each.end && dayOf(each.end.endedAt) === day),
          history.deliveries,
        ),
      })),
      taskFailures: taskFailureSummaries(
        failing.filter((each) => each.occurrence.stationId === place.stationId),
      ),
      runFailures: runFailureSummaries(here),
    };
  });
};
