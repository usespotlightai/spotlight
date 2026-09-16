import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function RunnerCardSkeleton() {
  return (
    <li className="flex min-h-36 flex-col justify-between gap-5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SkeletonLine className="w-28 text-sm" />

          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
            <Skeleton className="size-1.5 rounded-full" />
            <SkeletonLine className="w-10" />
          </span>
        </div>

        <span className="flex flex-wrap items-center gap-1">
          <Skeleton className="h-[1.375rem] w-20 rounded-full" />
        </span>
      </div>

      <SkeletonLine className="w-28 text-xs" />
    </li>
  );
}
