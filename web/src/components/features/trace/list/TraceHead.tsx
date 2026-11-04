import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { TABLE_HEAD } from '@/components/shared/table-rows';
import { cn } from '@/lib/utils';

export function TraceHead() {
  return (
    <div className={cn(TABLE_HEAD, TRACE_COLUMNS)}>
      <span aria-hidden />
      <span className="truncate">Started</span>
      <span className="truncate">Stations</span>
      <span className="truncate">Task</span>
      <span className="truncate">Input</span>
      <span className="truncate">Output</span>
      <span className="truncate text-right">Errors</span>
      <span className="truncate text-right">Duration</span>
      <span className="truncate text-right">Cost</span>
    </div>
  );
}
