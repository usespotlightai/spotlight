import { StationIcon } from '@/components/features/board/column/StationIcon';
import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Checkbox } from '@/components/ui/checkbox';
import { formatShortDuration } from '@/lib/inbox';
import { formatSpend, type InsightsTrace } from '@/lib/insights';
import { stationShare } from '@/lib/station';
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
  return (
    <div
      className={cn(
        'group/trace relative grid h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors',
        selected ? 'bg-selected' : 'hover:bg-accent',
        TRACE_COLUMNS,
      )}
    >
      <span className="pointer-events-none relative z-10 flex items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectedChange}
          aria-label={`Select ${trace.title}`}
          className={cn(
            'pointer-events-auto opacity-0 transition-opacity focus-visible:opacity-100 group-hover/trace:opacity-100',
            selected && 'opacity-100',
          )}
        />
      </span>

      <span className="truncate text-muted-foreground text-xs tabular-nums">
        {startedOn(trace.startedAt)}
      </span>

      <span
        className="flex min-w-0 items-center gap-0.5"
        title={trace.stations.map((station) => station.name).join(' → ')}
      >
        {trace.stations.map((station) => (
          <StationIcon
            key={station.stationId}
            share={stationShare(station.position, station.count)}
            color={station.color}
          />
        ))}
      </span>

      <span className="flex min-w-0 items-center gap-1">
        <TrailLink
          to={to}
          className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
        >
          {trace.title}
        </TrailLink>

        {trace.runs.length < trace.total && (
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {trace.runs.length} of {trace.total} runs
          </span>
        )}
      </span>

      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {trace.input ?? '–'}
      </span>

      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {trace.output ?? '–'}
      </span>

      <span
        className={cn(
          'truncate text-right text-xs tabular-nums',
          trace.errors > 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {trace.errors > 0 ? trace.errors : '–'}
      </span>

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        {trace.ms === null ? '–' : formatShortDuration(trace.ms)}
      </span>

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        {formatSpend(trace.cost)}
      </span>
    </div>
  );
}
