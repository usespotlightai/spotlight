import { StationIcon } from '@/components/features/board/column/StationIcon';
import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Checkbox } from '@/components/ui/checkbox';
import { spentOn, took } from '@/lib/inbox';
import { stationShare } from '@/lib/station';
import { startedOn, type Traced } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

type TraceRowProps = {
  trace: Traced;
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
    <li
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
            key={station.name}
            share={stationShare(station.position, station.count)}
            color={station.color}
          />
        ))}
      </span>

      <TrailLink
        to={to}
        className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
      >
        {trace.title}
      </TrailLink>

      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {trace.input ?? '–'}
      </span>

      <span className="min-w-0 truncate text-muted-foreground text-xs">
        {trace.output ?? '–'}
      </span>

      <span
        className={cn(
          'truncate text-right text-xs tabular-nums',
          trace.faults > 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {trace.faults > 0 ? trace.faults : '–'}
      </span>

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        {trace.ms === null ? '–' : took(trace.ms)}
      </span>

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        {spentOn(trace.cost)}
      </span>
    </li>
  );
}
