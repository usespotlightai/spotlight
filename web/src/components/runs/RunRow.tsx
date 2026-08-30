import { Inbox } from 'lucide-react';
import { Link } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { Pill } from '@/components/common/Pill';
import { type Run, reviewInk, standing } from '@/lib/run';
import { since } from '@/lib/runner';
import { stationShare } from '@/lib/station';

type RunRowProps = {
  run: Run;
  to: string;
  /** Shown where a run is read away from the task it worked. */
  taskTitle?: string | null;
  reviewTo?: string;
  /** A trail shows the asking as a step of its own, so the row does not. */
  inTrail?: boolean;
};

export function RunRow({ run, to, taskTitle, reviewTo, inTrail }: RunRowProps) {
  return (
    <li className="relative flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent">
      {run.station ? (
        <StationIcon
          share={stationShare(run.station.position, run.station.count)}
          color={run.station.color}
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}

      <Link
        to={to}
        className="min-w-0 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
      >
        {taskTitle ?? run.station?.name ?? 'Unknown station'}
      </Link>

      {taskTitle && run.station && (
        <span className="shrink-0 truncate text-muted-foreground text-xs">
          {run.station.name}
        </span>
      )}

      {run.attempt > 1 && (
        <span className="shrink-0 text-muted-foreground text-xs">
          attempt {run.attempt}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {run.review && !inTrail && (
          <Link to={reviewTo ?? ''} className="relative z-10 outline-none">
            <Pill
              lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}
              className={reviewInk(run.review)}
            >
              Awaiting review
            </Pill>
          </Link>
        )}

        <span className="text-muted-foreground text-xs">{standing(run)}</span>

        <span className="text-muted-foreground text-xs tabular-nums">
          {since(run.startedAt)}
        </span>
      </span>
    </li>
  );
}
