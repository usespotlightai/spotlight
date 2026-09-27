import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TeamMemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the team’s memory"
      className="flex flex-col gap-2 px-3"
    >
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-3">
        <div className="flex flex-col text-sm leading-6">
          <SkeletonLine className="w-3/5" />
        </div>
        <Skeleton className="h-4 w-40 rounded-full" />
      </div>
    </div>
  );
}
