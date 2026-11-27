import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { SinceSkeleton } from '@/components/features/team/SinceSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function RunRowSkeleton({ gutter = false }: { gutter?: boolean }) {
  return (
    <li
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-md py-2 text-sm @xl/pane:h-9 @xl/pane:items-center @xl/pane:py-0',
        gutter ? 'px-3' : 'px-2',
      )}
    >
      {gutter && <span className="w-4 shrink-0" aria-hidden />}
      <span className="flex h-5 shrink-0 items-center @xl/pane:h-auto">
        <StationIconSkeleton />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 @xl/pane:flex-row @xl/pane:items-center @xl/pane:gap-2">
        <span className="flex h-5 items-center">
          <SkeletonLine className="w-36" />
        </span>
        <span className="flex h-4 items-center @xl/pane:contents">
          <SinceSkeleton />
        </span>
      </div>
    </li>
  );
}
