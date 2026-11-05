import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { TileGroup } from '@/components/features/insights/TileGroup';
import {
  DELIVERY_NOTE,
  type Flow,
  formatCount,
  formatMedian,
  formatSlowest,
  mergedFilter,
  shownDeltaOf,
  tasksFilter,
} from '@/lib/insights';

type DeliveryStagesProps = {
  delivery: Flow['delivery'];
};

export function DeliveryStages({ delivery }: DeliveryStagesProps) {
  const opened = tasksFilter(delivery.openedTaskIds);
  const reviewed = tasksFilter(delivery.reviewedTaskIds);

  return (
    <TileGroup title="Past the last station" tooltip={DELIVERY_NOTE}>
      <InsightsTile
        label="PRs opened"
        value={formatCount(delivery.opened)}
        detail={`Task to PR ${formatMedian(delivery.toPullRequest)}`}
        tooltip={formatSlowest(delivery.toPullRequest)}
        delta={shownDeltaOf(delivery.changes.opened)}
        drill={opened ? { tab: 'traces', filter: opened } : undefined}
      />
      <InsightsTile
        label="First reviews"
        value={formatCount(delivery.reviewed)}
        detail={`PR to review ${formatMedian(delivery.toFirstReview)}`}
        tooltip={formatSlowest(delivery.toFirstReview)}
        delta={shownDeltaOf(delivery.changes.reviewed)}
        drill={reviewed ? { tab: 'traces', filter: reviewed } : undefined}
      />
      <InsightsTile
        label="PRs merged"
        value={formatCount(delivery.merged)}
        detail={`Review to merge ${formatMedian(delivery.toMerge)}`}
        tooltip={formatSlowest(delivery.toMerge)}
        delta={shownDeltaOf(delivery.changes.merged)}
        drill={{ tab: 'traces', filter: mergedFilter(delivery.mergedTaskIds) }}
      />
    </TileGroup>
  );
}
