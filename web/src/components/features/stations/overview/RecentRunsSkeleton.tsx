import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function RecentRunsSkeleton() {
  return (
    <div role="status" aria-label="Loading the station’s runs">
      <InsightsCardSkeleton rows={6} />
    </div>
  );
}
