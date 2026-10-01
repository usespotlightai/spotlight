import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { COST_DIMENSIONS } from '@/lib/insights';

export function CostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the cost"
      className="flex flex-col gap-4"
    >
      <InsightsTilesSkeleton
        labels={['Spend', 'Runs with no price', 'Cache share']}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {COST_DIMENSIONS.map((dimension) => (
          <InsightsCardSkeleton
            key={dimension.id}
            title={dimension.label}
            rows={3}
          />
        ))}
      </div>
      <InsightsCardSkeleton title="Read from cache" rows={3} />
    </div>
  );
}
