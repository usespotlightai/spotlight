import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { CarriedConfigs } from '@insights/domain/services/config-intervals';
import {
  type ConfigMarker,
  configMarkersOf,
  type DaySpending,
  daySpendingOf,
} from '@insights/domain/services/daily-output';
import {
  type HeadlineCounts,
  headlineCountsOf,
  type ResolvedDelivery,
  resolvedDeliveriesOf,
} from '@insights/domain/services/headline';
import {
  type FailingTask,
  failingTasksOf,
  type TeamCounts,
  teamCountsOf,
} from '@insights/domain/services/station-reports';
import type { TeamHistory } from '@insights/domain/services/team-history';
import type { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';

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
  openings: ReadonlyMap<string, TaskHumanActions>,
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
    { ...history, taskHumanActions: [...openings.values()] },
    period,
  ),
  failingBefore: failingTasksOf(
    { ...history, taskHumanActions: [...openings.values()] },
    period.previous,
  ),
});
