import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TeamMemberRowSkeleton() {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <Skeleton className="size-6 rounded-full" />

      <span className="min-w-0 flex-1 text-sm">
        <SkeletonLine className="w-28" />
      </span>

      <span className="shrink-0 px-2 text-sm">
        <SkeletonLine className="w-12" />
      </span>
    </div>
  );
}
