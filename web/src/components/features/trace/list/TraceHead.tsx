import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { cn } from '@/lib/utils';

export function TraceHead() {
  return (
    <div
      className={cn(
        'grid h-8 items-center gap-3 px-3 text-muted-foreground text-xs',
        TRACE_COLUMNS,
      )}
    >
      <span aria-hidden />
      <span className="truncate">Started</span>
      <span className="truncate">Stations</span>
      <span className="truncate">Task</span>
      <span className="truncate">Input</span>
      <span className="truncate">Output</span>
      <span className="truncate text-right">Errors</span>
      <span className="truncate text-right">Took</span>
      <span className="truncate text-right">Cost</span>
    </div>
  );
}
