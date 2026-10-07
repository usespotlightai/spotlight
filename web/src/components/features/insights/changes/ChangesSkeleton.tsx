import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function ChangesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the changes"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton rows={3} />
      <InsightsCardSkeleton rows={9} />
    </div>
  );
}
