import {
  TRACE_COLUMNS,
  TRACE_HEAD_CELL as CELL,
} from '@/components/features/trace/list/columns';
import { TABLE_HEAD } from '@/components/shared/table-rows';
import { cn } from '@/lib/utils';

export function TraceHead() {
  return (
    <div className={cn(TABLE_HEAD, TRACE_COLUMNS, 'h-8 py-0 @2xl/pane:h-8')}>
      <span aria-hidden className={CELL.select} />
      <span className={cn('truncate', CELL.started)}>Started</span>
      <span className={cn('truncate', CELL.stations)}>Stations</span>
      <span className={cn('truncate', CELL.task)}>Task</span>
      <span className={cn('truncate', CELL.detail)}>Input</span>
      <span className={cn('truncate', CELL.detail)}>Output</span>
      <span className={cn('truncate text-right', CELL.errors)}>Errors</span>
      <span className={cn('truncate text-right', CELL.duration)}>Duration</span>
      <span className={cn('truncate text-right', CELL.cost)}>Cost</span>
    </div>
  );
}
