import {
  MEMORY_COLUMNS,
  MEMORY_WIDE_CELL,
} from '@/components/features/memory/columns';
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
      <span className="hidden truncate @md/pane:block">Kind</span>
      <span className={cn('truncate', MEMORY_WIDE_CELL)}>Applies to</span>
      <span className={cn('truncate', MEMORY_WIDE_CELL)}>Source</span>
      <span className={cn('truncate', MEMORY_WIDE_CELL)}>Approved by</span>
      <span className={cn('truncate text-right', MEMORY_WIDE_CELL)}>Runs</span>
    </div>
  );
}
