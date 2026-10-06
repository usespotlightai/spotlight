import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function ShippingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading what the agents ship"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton rows={5} />
      <div className="grid gap-3 lg:grid-cols-2">
        <InsightsCardSkeleton rows={4} />
        <InsightsCardSkeleton rows={4} />
      </div>
    </div>
  );
}
