import { useState } from 'react';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { TraceSelectionBar } from '@/components/features/trace/list/TraceSelectionBar';
import { TraceVolume } from '@/components/features/trace/list/TraceVolume';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Checkbox } from '@/components/ui/checkbox';
import { useAnalyseTraces } from '@/hooks/api/useAnalyseTraces';
import { useTeamTraces } from '@/hooks/api/useTeamTraces';
import { spentOn, took } from '@/lib/inbox';
import { stationShare } from '@/lib/station';
import { taskTracePath } from '@/lib/task';
import { startedOn, type Traced } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

const COLUMNS =
  'grid-cols-[1.25rem_6.25rem_6rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_5rem_4.5rem]';

const Head = ({ children }: { children: React.ReactNode }) => (
  <span className="truncate">{children}</span>
);

function Row({
  trace,
  to,
  selected,
  onSelectedChange,
}: {
  trace: Traced;
  to: string;
  selected: boolean;
  onSelectedChange: (on: boolean) => void;
}) {
  return (
    <li
      className={cn(
        'group/trace relative grid h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors',
        selected ? 'bg-selected' : 'hover:bg-accent',
        COLUMNS,
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

export function TraceList({
  slug,
  teamId,
  range,
}: {
  slug: string;
  teamId: string;
  range: string;
}) {
  const { data: traces, isPending } = useTeamTraces(teamId, range);
  const analyseTraces = useAnalyseTraces();

  const [selected, setSelected] = useState<readonly string[]>([]);

  if (isPending) {
    return null;
  }

  const worked = traces ?? [];

  const toggle = (taskId: string, on: boolean) =>
    setSelected((current) =>
      on ? [...current, taskId] : current.filter((each) => each !== taskId),
    );

  const analyse = async () => {
    await analyseTraces.mutateAsync({ teamId, taskIds: selected });
    setSelected([]);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <TraceVolume traces={worked} range={range} />

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        <div
          className={cn(
            'grid h-8 items-center gap-3 px-3 text-muted-foreground text-xs',
            COLUMNS,
          )}
        >
          <span aria-hidden />
          <Head>Started</Head>
          <Head>Stations</Head>
          <Head>Task</Head>
          <Head>Asked</Head>
          <Head>Answered</Head>
          <span className="truncate text-right">Faults</span>
          <span className="truncate text-right">Took</span>
          <span className="truncate text-right">Cost</span>
        </div>

        <ul className="flex flex-col">
          {worked.map((trace) => (
            <Row
              key={trace.taskId}
              trace={trace}
              to={taskTracePath(slug, teamId, trace.taskId)}
              selected={selected.includes(trace.taskId)}
              onSelectedChange={(on) => toggle(trace.taskId, on)}
            />
          ))}
        </ul>
      </div>

      <TraceSelectionBar
        count={selected.length}
        pending={analyseTraces.isPending}
        onAnalyse={analyse}
        onClear={() => setSelected([])}
      />
    </div>
  );
}
