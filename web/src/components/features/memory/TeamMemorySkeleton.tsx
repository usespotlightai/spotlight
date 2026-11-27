import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { TeamMemoryTable } from '@/components/features/memory/TeamMemoryTable';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

const WIDE = 'hidden @4xl/pane:flex';

const BODY_WIDTHS = ['w-3/5', 'w-2/5', 'w-4/5', 'w-1/2'] as const;

export function TeamMemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the team’s memory"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TeamMemoryTable>
        {BODY_WIDTHS.map((width) => (
          <li
            key={width}
            className={cn(
              'grid min-h-9 items-center gap-1 rounded-md px-3 py-2 text-sm @md/pane:h-9 @md/pane:gap-3 @md/pane:py-0',
              MEMORY_COLUMNS,
            )}
          >
            <SkeletonLine className={width} />
            <SkeletonLine className="w-16 text-xs @md/pane:text-sm" />
            <SkeletonLine className={cn('w-24 text-sm', WIDE)} />
            <SkeletonLine className={cn('w-12 text-sm', WIDE)} />
            <SkeletonLine className={cn('w-16 text-sm', WIDE)} />
            <SkeletonLine className={cn('ml-auto w-6 text-sm', WIDE)} />
          </li>
        ))}
      </TeamMemoryTable>
    </div>
  );
}
