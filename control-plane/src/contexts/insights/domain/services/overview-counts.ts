import {
  type ConfigMarker,
  type DaySpending,
} from '@insights/domain/services/daily-output';
import type { HeadlineCounts } from '@insights/domain/services/headline';
import type { PullRequestDelivery } from '@insights/domain/services/pull-request-delivery';
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
  readonly stations: TeamCounts;
  readonly failingBefore: readonly FailingTask[];
}
