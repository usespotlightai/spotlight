import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { TeamMemoryTable } from '@/components/features/memory/TeamMemoryTable';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

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
              'grid h-9 items-center gap-3 rounded-md px-3 text-sm',
              MEMORY_COLUMNS,
            )}
          >
            <SkeletonLine className={width} />
            <SkeletonLine className="w-16 text-xs" />
            <SkeletonLine className="w-24 text-xs" />
            <SkeletonLine className="w-12 text-xs" />
            <SkeletonLine className="w-16 text-xs" />
            <SkeletonLine className="ml-auto w-6 text-xs" />
          </li>
        ))}
      </TeamMemoryTable>
    </div>
  );
}
