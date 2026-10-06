import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function StationsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the stations"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton title="The whole team" rows={1} />
      <InsightsCardSkeleton title="By station" rows={6} />
    </div>
  );
}
