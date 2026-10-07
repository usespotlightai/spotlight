import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function StationsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the stations"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={7} />
      <InsightsCardSkeleton rows={4} />
    </div>
  );
}
