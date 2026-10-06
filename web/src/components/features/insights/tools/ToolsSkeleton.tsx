import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function ToolsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the tools"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton rows={6} />
      <InsightsCardSkeleton rows={1} />
      <InsightsCardSkeleton rows={4} />
    </div>
  );
}
