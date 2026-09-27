import { MemoryReviewAbout } from '@/components/features/inbox/memories/MemoryReviewAbout';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function MemoryReviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the proposed memories"
      className="flex flex-col gap-4"
    >
      <MemoryReviewAbout />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="flex flex-col text-sm leading-6">
          <SkeletonLine className="w-4/5" />
          <SkeletonLine className="w-2/5" />
        </div>
      </div>
    </div>
  );
}
