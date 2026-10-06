import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function RunsSkeleton() {
  return (
    <div role="status" aria-label="Loading the runs">
      <InsightsCardSkeleton rows={8} />
    </div>
  );
}
