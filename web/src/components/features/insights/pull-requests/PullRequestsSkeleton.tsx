import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function PullRequestsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the pull requests"
      className="flex flex-col gap-4"
    >
      <InsightsTilesSkeleton
        labels={['PRs merged', 'Made by Spotlight', 'Reviewed by Spotlight']}
      />
      <InsightsCardSkeleton title="By repository" rows={3} />
      <InsightsCardSkeleton title="Spotlight against people" rows={5} />
    </div>
  );
}
