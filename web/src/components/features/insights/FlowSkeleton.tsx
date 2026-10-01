import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function FlowSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the flow"
      className="flex flex-col gap-4"
    >
      <InsightsCardSkeleton title="Where tasks wait" rows={5} />
      <InsightsTilesSkeleton
        labels={['PRs opened', 'First reviews', 'PRs merged']}
      />
    </div>
  );
}
