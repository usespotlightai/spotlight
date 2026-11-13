import {
  TRACE_CELL as CELL,
  TRACE_COLUMNS,
} from '@/components/features/trace/list/columns';
import { TraceStations } from '@/components/features/trace/list/TraceStations';
import { TABLE_ROW } from '@/components/shared/table-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Checkbox } from '@/components/ui/checkbox';
import { formatShortDuration } from '@/lib/inbox';
import { formatSpend, type InsightsTrace } from '@/lib/insights';
import { startedOn } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

type TraceRowProps = {
  trace: InsightsTrace;
  to: string;
  selected: boolean;
  onSelectedChange: (on: boolean) => void;
};

export function TraceRow({
  trace,
  to,
  selected,
  onSelectedChange,
}: TraceRowProps) {
  const errorsLabel = `${trace.errors} ${trace.errors === 1 ? 'error' : 'errors'}`;

  return (
    <div
      className={cn(
        TABLE_ROW,
        'group/trace transition-colors [contain-intrinsic-size:auto_2.25rem] [content-visibility:auto]',
        selected ? 'bg-selected' : 'hover:bg-accent',
        TRACE_COLUMNS,
      )}
    >
      <span
        className={cn(
          'pointer-events-none relative z-10 flex items-center',
          CELL.select,
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectedChange}
          aria-label={`Select ${trace.title}`}
          className={cn(
            'pointer-events-auto relative opacity-0 transition-opacity focus-visible:opacity-100 group-hover/trace:opacity-100 pointer-coarse:size-4 pointer-coarse:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:-inset-3',
            selected && 'opacity-100',
          )}
        />
      </span>

      <span
        className={cn(
          'truncate text-muted-foreground text-xs tabular-nums',
          CELL.started,
        )}
        title={new Date(trace.startedAt).toLocaleString()}
      >
        {startedOn(trace.startedAt)}
      </span>

      <span
        className={cn(
          'flex min-w-0 items-center gap-0.5 overflow-hidden',
          CELL.stations,
        )}
        title={trace.stations.map((station) => station.name).join(' → ')}
      >
        <TraceStations stations={trace.stations} errors={trace.errors} />
      </span>

      <span className={cn('flex min-w-0 items-center gap-1', CELL.task)}>
        <TrailLink
          to={to}
          className="line-clamp-2 min-w-0 text-foreground outline-none after:absolute after:inset-0 after:rounded-md @2xl/pane:line-clamp-1"
          title={trace.title}
        >
          {trace.title}
        </TrailLink>

        {trace.runs.length < trace.total && (
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {trace.runs.length} of {trace.total} runs
          </span>
        )}
      </span>

      <span
        className={cn(
          'min-w-0 truncate text-muted-foreground text-xs',
          CELL.detail,
        )}
        title={trace.input ?? undefined}
      >
        {trace.input ?? '–'}
      </span>

      <span
        className={cn(
          'min-w-0 truncate text-muted-foreground text-xs',
          CELL.detail,
        )}
        title={trace.output ?? undefined}
      >
        {trace.output ?? '–'}
      </span>

      <span
        className={cn(
          'truncate text-right text-xs tabular-nums',
          CELL.errors,
          trace.errors > 0 ? 'text-outcome-failed' : 'text-muted-foreground',
        )}
        title={errorsLabel}
        aria-label={errorsLabel}
      >
        {trace.errors > 0 ? trace.errors : '–'}
      </span>

      <span
        className={cn(
          'truncate text-right text-muted-foreground text-xs tabular-nums',
          CELL.duration,
        )}
        title={trace.ms === null ? undefined : formatShortDuration(trace.ms)}
      >
        {trace.ms === null ? '–' : formatShortDuration(trace.ms)}
      </span>

      <span
        className={cn(
          'truncate text-right text-muted-foreground text-xs tabular-nums',
          CELL.cost,
        )}
      >
        {formatSpend(trace.cost)}
      </span>
    </div>
  );
}
