import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { cn } from '@/lib/utils';

export function MemoryHead() {
  return (
    <div
      className={cn(
        'grid h-8 items-center gap-3 px-3 text-muted-foreground text-xs',
        MEMORY_COLUMNS,
      )}
    >
      <span className="truncate">Memory</span>
      <span className="truncate">Kind</span>
      <span className="truncate">Applies to</span>
      <span className="truncate">Source</span>
      <span className="truncate">Approved by</span>
      <span className="truncate text-right">Runs</span>
    </div>
  );
}
