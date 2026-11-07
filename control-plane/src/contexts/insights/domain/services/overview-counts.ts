import {
  type ConfigMarker,
  type DaySpending,
} from '@insights/domain/services/daily-output';
import {
  type HeadlineCounts,
  type ResolvedDelivery,
} from '@insights/domain/services/headline';
import {
  type FailingTask,
  type TeamCounts,
} from '@insights/domain/services/station-reports';

export interface OverviewCounts {
  readonly current: HeadlineCounts;
  readonly previous: HeadlineCounts;
  readonly resolved: readonly ResolvedDelivery[];
  readonly spending: ReadonlyMap<string, DaySpending>;
  readonly markers: readonly ConfigMarker[];
  readonly stations: TeamCounts;
  readonly failingBefore: readonly FailingTask[];
}
