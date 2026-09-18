import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function TraceRowSkeleton() {
  return (
    <li
      className={cn(
        'grid h-9 items-center gap-3 rounded-md px-3 text-sm',
        TRACE_COLUMNS,
      )}
    >
      <span aria-hidden />
      <SkeletonLine className="w-20 text-xs" />
      <span className="flex min-w-0 items-center gap-0.5">
        <StationIconSkeleton />
      </span>
      <SkeletonLine className="w-36" />
      <span aria-hidden />
      <span aria-hidden />
      <span aria-hidden />
      <SkeletonLine className="ml-auto w-8 text-xs" />
      <SkeletonLine className="ml-auto w-8 text-xs" />
    </li>
  );
}
