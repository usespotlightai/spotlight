import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { COST_DIMENSIONS } from '@/lib/insights';

export function CostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the cost"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={3} />
      <div className="grid gap-3 md:grid-cols-2">
        {COST_DIMENSIONS.map((dimension) => (
          <InsightsCardSkeleton key={dimension.id} rows={3} />
        ))}
      </div>
      <InsightsCardSkeleton rows={3} />
    </div>
  );
}
