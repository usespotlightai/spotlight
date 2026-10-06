import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

const TILES = [
  'Spend',
  'PRs merged',
  'Merge rate',
  'Cost per merged PR',
  'Task to merge',
  'Human touches per task',
  'Active people',
];

export function OverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the overview"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={TILES.length} />
      <InsightsCardSkeleton rows={6} />
      <InsightsCardSkeleton rows={3} />
    </div>
  );
}
