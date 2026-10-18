import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { TileGroup } from '@/components/features/insights/TileGroup';
import {
  DELIVERY_NOTE,
  type Flow,
  formatCount,
  formatSpread,
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
        detail={`Task to PR ${formatSpread(delivery.toPullRequest)}`}
        delta={shownDeltaOf(delivery.changes.opened)}
        drill={opened ? { tab: 'runs', filter: opened } : undefined}
      />
      <InsightsTile
        label="First reviews"
        value={formatCount(delivery.reviewed)}
        detail={`PR to review ${formatSpread(delivery.toFirstReview)}`}
        delta={shownDeltaOf(delivery.changes.reviewed)}
        drill={reviewed ? { tab: 'runs', filter: reviewed } : undefined}
      />
      <InsightsTile
        label="PRs merged"
        value={formatCount(delivery.merged)}
        detail={`Review to merge ${formatSpread(delivery.toMerge)}`}
        delta={shownDeltaOf(delivery.changes.merged)}
        drill={{ tab: 'runs', filter: mergedFilter(delivery.mergedTaskIds) }}
      />
    </TileGroup>
  );
}
