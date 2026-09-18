import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { SinceSkeleton } from '@/components/features/team/SinceSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function RunRowSkeleton({ gutter = false }: { gutter?: boolean }) {
  return (
    <li
      className={cn(
        'flex h-9 min-w-0 items-center gap-2 rounded-md text-sm',
        gutter ? 'px-3' : 'px-2',
      )}
    >
      {gutter && <span className="w-4 shrink-0" aria-hidden />}
      <StationIconSkeleton />
      <SkeletonLine className="w-36" />
      <SinceSkeleton />
    </li>
  );
}
