import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function MemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the memory"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={5} />
      <InsightsCardSkeleton rows={8} />
      <InsightsCardSkeleton rows={3} />
    </div>
  );
}
