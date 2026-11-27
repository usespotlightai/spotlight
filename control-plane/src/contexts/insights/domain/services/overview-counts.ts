import {
  type ConfigMarker,
  type DaySpending,
} from '@insights/domain/services/daily-output';
import type { HeadlineCounts } from '@insights/domain/services/headline';
import type { PullRequestDelivery } from '@insights/domain/services/pull-request-delivery';
import type { LeftOutCount } from '@insights/domain/services/station-ranking';
import {
  type FailingTask,
  type TeamCounts,
} from '@insights/domain/services/station-reports';

export interface OverviewCounts {
  readonly current: HeadlineCounts;
  readonly previous: HeadlineCounts;
  readonly deliveries: readonly PullRequestDelivery[];
  readonly spending: ReadonlyMap<string, DaySpending>;
  readonly markers: readonly ConfigMarker[];
  /** Counted over the runs that count for their station only. */
  readonly stations: TeamCounts;
  readonly failingBefore: readonly FailingTask[];
  readonly leftOut: readonly LeftOutCount[];
}
