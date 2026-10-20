import { StationIcon } from '@/components/features/board/column/StationIcon';
import { RunPendingMarker } from '@/components/features/runs/RunPendingMarker';
import { WorkState } from '@/components/shared/WorkState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type Run, runStatus, waitsOnPerson, workOf } from '@/lib/run';
import { since } from '@/lib/since';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type RunRowProps = {
  run: Run;
  to: string;
  taskTitle?: string | null;
  reviewTo?: string;
  inTrail?: boolean;
  gutter?: boolean;
};

export function RunRow({
  run,
  to,
  taskTitle,
  reviewTo,
  inTrail,
  gutter,
}: RunRowProps) {
  const waits = waitsOnPerson(run);
  const status = runStatus(run);
  const work = workOf(run);

  return (
    <li
      className={cn(
        'relative flex h-9 min-w-0 items-center gap-2 rounded-md text-sm transition-colors hover:bg-accent',
        gutter ? 'px-3' : 'px-2',
      )}
    >
      {gutter && <span className="w-4 shrink-0" aria-hidden />}

      {run.station ? (
        <StationIcon
          share={stationShare(run.station.position, run.station.count)}
          color={run.station.color}
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}

      <TrailLink
        to={to}
        className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
      >
        {taskTitle ?? run.station?.name ?? 'Unknown station'}
      </TrailLink>

      {taskTitle && run.station && (
        <span className="shrink-0 truncate text-muted-foreground text-xs">
          {run.station.name}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <RunPendingMarker run={run} reviewTo={reviewTo} inTrail={inTrail} />

        {work && <WorkState work={work} />}

        {status && !waits && (
          <span className="text-muted-foreground text-xs">{status}</span>
        )}

        <span className="w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
          {since(run.startedAt)}
        </span>
      </span>
    </li>
  );
}
