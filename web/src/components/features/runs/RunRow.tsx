import { CircleArrowRight, CircleSlash } from 'lucide-react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { RunPendingMarker } from '@/components/features/runs/RunPendingMarker';
import { Pill } from '@/components/shared/Pill';
import { ProgressState } from '@/components/shared/ProgressState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type Run, runStatus, waitsOnPerson } from '@/lib/run';
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

  const title = taskTitle ?? run.station?.name ?? 'Unknown station';

  return (
    <li
      className={cn(
        'relative flex min-w-0 items-start gap-2 rounded-md py-2 text-sm transition-colors hover:bg-accent @xl/pane:h-9 @xl/pane:items-center @xl/pane:py-0',
        gutter ? 'px-3' : 'px-2',
      )}
    >
      {gutter && <span className="w-4 shrink-0" aria-hidden />}

      <span className="flex h-5 shrink-0 items-center @xl/pane:h-auto">
        {run.station ? (
          <StationIcon
            share={stationShare(run.station.position, run.station.count)}
            color={run.station.color}
          />
        ) : (
          <span className="size-4 shrink-0" aria-hidden />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 @xl/pane:flex-nowrap">
        <TrailLink
          to={to}
          title={title}
          className={cn(
            'min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md',
            taskTitle && 'basis-full @xl/pane:basis-auto',
          )}
        >
          {title}
        </TrailLink>

        <div className="flex min-w-0 grow flex-wrap items-center gap-x-2 gap-y-1 @xl/pane:contents">
          {taskTitle && run.station && (
            <span
              title={run.station.name}
              className="min-w-[6rem] truncate text-muted-foreground text-xs @xl/pane:min-w-0 @xl/pane:shrink-0"
            >
              {run.station.name}
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-2">
            <RunPendingMarker run={run} reviewTo={reviewTo} inTrail={inTrail} />

            {run.progress && <ProgressState progress={run.progress} />}

            {status && !waits && <EndedPill run={run} status={status} />}

            <span className="shrink-0 text-right text-muted-foreground text-xs tabular-nums @xl/pane:w-20">
              {since(run.startedAt)}
            </span>
          </span>
        </div>
      </div>
    </li>
  );
}

function EndedPill({ run, status }: { run: Run; status: string }) {
  const Icon = run.state === 'superseded' ? CircleArrowRight : CircleSlash;

  return (
    <Pill lead={<Icon className="size-3.5 shrink-0" aria-hidden />}>
      {status}
    </Pill>
  );
}
