import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function PullRequestsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the pull requests"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={3} />
      <InsightsCardSkeleton rows={3} />
      <InsightsCardSkeleton rows={5} />
    </div>
  );
}
