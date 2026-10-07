import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { MemoryHead } from '@/components/features/memory/MemoryHead';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function TeamMemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the team’s memory"
      className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-2 pb-1.5"
    >
      <MemoryHead />

      <ul className="flex flex-col">
        <li
          className={cn(
            'grid h-9 items-center gap-3 rounded-md px-3 text-sm',
            MEMORY_COLUMNS,
          )}
        >
          <SkeletonLine className="w-3/5" />
          <SkeletonLine className="w-16 text-xs" />
          <SkeletonLine className="w-24 text-xs" />
          <SkeletonLine className="w-12 text-xs" />
          <SkeletonLine className="w-16 text-xs" />
          <SkeletonLine className="ml-auto w-6 text-xs" />
        </li>
      </ul>
    </div>
  );
}
