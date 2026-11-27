import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import {
  TRACE_CELL as CELL,
  TRACE_COLUMNS,
} from '@/components/features/trace/list/columns';
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
      <span aria-hidden className={CELL.select} />
      <SkeletonLine className={cn('w-20 text-xs', CELL.started)} />
      <span className={cn('flex min-w-0 items-center gap-0.5', CELL.stations)}>
        <StationIconSkeleton />
      </span>
      <SkeletonLine className={cn('w-36 max-w-full', CELL.task)} />
      <span aria-hidden className={CELL.detail} />
      <span aria-hidden className={CELL.detail} />
      <span aria-hidden className={CELL.errors} />
      <SkeletonLine className={cn('ml-auto w-8 text-xs', CELL.duration)} />
      <SkeletonLine className={cn('ml-auto w-8 text-xs', CELL.cost)} />
    </li>
  );
}
