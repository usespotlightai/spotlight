import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TeamSkillRowSkeleton() {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-8 rounded-full" />

        <div className="flex min-w-0 flex-col gap-0.5">
          <SkeletonLine className="w-28 text-sm" />
          <SkeletonLine className="w-48 text-xs" />
        </div>
      </div>
    </div>
  );
}
