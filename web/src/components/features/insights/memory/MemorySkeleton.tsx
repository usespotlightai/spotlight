import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function MemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the memory"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton
        labels={['Standing memories', 'Briefed', 'Read', 'Flagged wrong']}
      />
      <InsightsCardSkeleton title="Runs with memories and without" rows={5} />
      <InsightsCardSkeleton title="Flagged wrong" rows={2} />
      <InsightsCardSkeleton title="Memory benchmark" rows={1} />
    </div>
  );
}
