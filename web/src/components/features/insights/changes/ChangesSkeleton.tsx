import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function ChangesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the changes"
      className="flex flex-col gap-4"
    >
      <InsightsCardSkeleton title="Config changes" rows={3} />
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <p className="font-medium text-foreground text-sm">
          Harness, model, effort and profile
        </p>
        <div className="flex gap-2">
          <SkeletonLine className="w-24 text-xs" />
          <SkeletonLine className="w-20 text-xs" />
          <SkeletonLine className="w-24 text-xs" />
        </div>
        <SkeletonLine className="h-40 w-full" />
      </div>
    </div>
  );
}
