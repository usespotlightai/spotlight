import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import {
  countShown,
  deltaOf,
  type Flow,
  mergedFilter,
  spreadShown,
  tasksFilter,
} from '@/lib/insights';

type DeliveryStagesProps = {
  delivery: Flow['delivery'];
  before: Flow['delivery'];
};

export function DeliveryStages({ delivery, before }: DeliveryStagesProps) {
  const opened = tasksFilter(delivery.openedTaskIds);

  return (
    <InsightsCard
      title="Past the last station"
      description="From a task opening to its pull request, its first review by a person, and its merge. Times are the median and the p90."
    >
      <InsightsTiles label="Delivery">
        <InsightsTile
          label="PRs opened"
          value={countShown(delivery.opened)}
          detail={`Task to PR ${spreadShown(delivery.toPullRequest)}`}
          delta={deltaOf(delivery.opened, before.opened, 'up')}
          drill={opened ? { tab: 'runs', filter: opened } : undefined}
        />
        <InsightsTile
          label="First reviews"
          value={countShown(delivery.reviewed)}
          detail={`PR to review ${spreadShown(delivery.toFirstReview)}`}
          delta={deltaOf(delivery.reviewed, before.reviewed, 'up')}
        />
        <InsightsTile
          label="PRs merged"
          value={countShown(delivery.merged)}
          detail={`Review to merge ${spreadShown(delivery.toMerge)}`}
          delta={deltaOf(delivery.merged, before.merged, 'up')}
          drill={{ tab: 'runs', filter: mergedFilter(delivery.mergedTaskIds) }}
        />
      </InsightsTiles>
    </InsightsCard>
  );
}
