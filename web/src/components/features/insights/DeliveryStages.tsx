import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { TileGroup } from '@/components/features/insights/TileGroup';
import {
  changeShown,
  countShown,
  type Flow,
  mergedFilter,
  spreadShown,
  tasksFilter,
} from '@/lib/insights';

type DeliveryStagesProps = {
  delivery: Flow['delivery'];
};

export function DeliveryStages({ delivery }: DeliveryStagesProps) {
  const opened = tasksFilter(delivery.openedTaskIds);
  const reviewed = tasksFilter(delivery.reviewedTaskIds);

  return (
    <TileGroup
      title="Past the last station"
      note="Time from when a task opens to its pull request, first human review and merge. Times: median and p90"
    >
      <InsightsTile
        label="PRs opened"
        value={countShown(delivery.opened)}
        detail={`Task to PR ${spreadShown(delivery.toPullRequest)}`}
        delta={changeShown(delivery.changes.opened)}
        drill={opened ? { tab: 'runs', filter: opened } : undefined}
      />
      <InsightsTile
        label="First reviews"
        value={countShown(delivery.reviewed)}
        detail={`PR to review ${spreadShown(delivery.toFirstReview)}`}
        delta={changeShown(delivery.changes.reviewed)}
        drill={reviewed ? { tab: 'runs', filter: reviewed } : undefined}
      />
      <InsightsTile
        label="PRs merged"
        value={countShown(delivery.merged)}
        detail={`Review to merge ${spreadShown(delivery.toMerge)}`}
        delta={changeShown(delivery.changes.merged)}
        drill={{ tab: 'runs', filter: mergedFilter(delivery.mergedTaskIds) }}
      />
    </TileGroup>
  );
}
