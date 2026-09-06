import { Inbox } from 'lucide-react';
import { StationIcon } from '@/components/board/StationIcon';
import { InProgress } from '@/components/common/InProgress';
import { Pill } from '@/components/common/Pill';
import { TrailLink } from '@/components/layout/TrailLink';
import { type Run, reviewInk, standing } from '@/lib/run';
import { since } from '@/lib/runner';
import { stationShare } from '@/lib/station';

type RunRowProps = {
  run: Run;
  to: string;
  taskTitle?: string | null;
  reviewTo?: string;
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
        {run.review && !inTrail && (
          <TrailLink to={reviewTo ?? ''} className="relative z-10 outline-none">
            <Pill
              lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}
              className={reviewInk(run.review)}
            >
              Awaiting review
            </Pill>
          </TrailLink>
        )}

        {run.state === 'claimed' && <InProgress />}

        {standing(run) && (
          <span className="text-muted-foreground text-xs">{standing(run)}</span>
        )}

        {/* Held to a width, or a shorter age pulls the pill beside it out of
            line with the rows above. The same width the board holds, so the
            two lists share one right-hand edge. */}
        <span className="w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
          {since(run.startedAt)}
        </span>
      </span>
    </li>
  );
}
