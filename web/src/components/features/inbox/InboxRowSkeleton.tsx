import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function InboxRowSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <StationIconSkeleton />
        <SkeletonLine className="w-3/5 text-sm" />
        <SkeletonLine className="ml-auto w-9 shrink-0 text-xs" />
      </span>

      <SkeletonLine className="w-4/5 pl-6 text-xs" />
    </div>
  );
}
