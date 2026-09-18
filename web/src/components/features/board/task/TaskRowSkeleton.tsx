import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function TaskRowSkeleton() {
  return (
    <li className="relative mx-1.5 rounded-md first:mt-0.5 last:mb-0.5">
      <div className="flex h-10 min-w-0 items-center gap-2 px-3">
        <span className="w-4 shrink-0" aria-hidden />

        <StationIconSkeleton />

        <span className="flex min-w-0 flex-1">
          <SkeletonLine className="w-48 text-sm" />
        </span>

        <Skeleton className="-ml-1 size-6 rounded-full" />

        <span className="ml-2 flex w-20 shrink-0 justify-end text-xs">
          <SkeletonLine className="w-10" />
        </span>
      </div>
    </li>
  );
}
