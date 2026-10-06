import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function StationOutcomesSkeleton() {
  return (
    <div role="status" aria-label="Loading how its runs turned out">
      <InsightsCardSkeleton rows={6} />
    </div>
  );
}
