import type { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import type { CarriedConfigs } from '@outcomes/domain/services/config-stretches';
import {
  type ConfigMarker,
  configMarkersOf,
  type DaySpending,
  daySpendingOf,
} from '@outcomes/domain/services/daily-output';
import {
  type HeadlineCounts,
  headlineCountsOf,
  type ResolvedDelivery,
  resolvedDeliveriesOf,
} from '@outcomes/domain/services/headline';
import {
  type FailingTask,
  failingTasksOf,
  type TeamCounts,
  teamCountsOf,
} from '@outcomes/domain/services/station-reports';
import type { TeamHistory } from '@outcomes/domain/services/team-history';
import type { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';

export interface OverviewCounts {
  readonly current: HeadlineCounts;
  readonly previous: HeadlineCounts;
  readonly resolved: readonly ResolvedDelivery[];
  readonly spending: ReadonlyMap<string, DaySpending>;
  readonly markers: readonly ConfigMarker[];
  readonly stations: TeamCounts;
  readonly failingBefore: readonly FailingTask[];
}

export const overviewCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  carried: CarriedConfigs,
  openings: ReadonlyMap<string, TaskTouches>,
): OverviewCounts => ({
  current: headlineCountsOf(history, period.current),
  previous: headlineCountsOf(history, period.previous),
  resolved: resolvedDeliveriesOf(history, openings).filter(
    (each) =>
      each.closedAt.getTime() >= period.previous.from.getTime() &&
      each.closedAt.getTime() < period.current.to.getTime(),
  ),
  spending: daySpendingOf(history, period),
  markers: configMarkersOf(history, period, carried),
  stations: teamCountsOf(
    { ...history, touches: [...openings.values()] },
    period,
  ),
  failingBefore: failingTasksOf(
    { ...history, touches: [...openings.values()] },
    period.previous,
  ),
});
