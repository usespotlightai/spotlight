import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function PeopleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the people"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={4} />
      <InsightsTilesSkeleton count={4} />
      <InsightsCardSkeleton rows={4} />
    </div>
  );
}
