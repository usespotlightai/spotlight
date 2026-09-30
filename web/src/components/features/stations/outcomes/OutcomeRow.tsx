import { OUTCOME_COLUMNS } from '@/components/features/stations/outcomes/columns';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { since } from '@/lib/runner';
import {
  checksShown,
  deliveryShown,
  endedBadly,
  endingShown,
  nextShown,
  runSpent,
  runTook,
  type StationRunOutcome,
} from '@/lib/station-outcomes';
import { cn } from '@/lib/utils';

const FIGURE = 'truncate text-muted-foreground text-xs';
const NUMBER = cn(FIGURE, 'text-right tabular-nums');

type OutcomeRowProps = {
  run: StationRunOutcome;
  to: string;
};

export function OutcomeRow({ run, to }: OutcomeRowProps) {
  return (
    <li
      className={cn(
        'relative grid h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent',
        OUTCOME_COLUMNS,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <TrailLink
          to={to}
          className={cn(
            'shrink-0 outline-none after:absolute after:inset-0 after:rounded-md',
            endedBadly(run.ending) ? 'text-destructive' : 'text-foreground',
          )}
        >
          {endingShown(run.ending)}
        </TrailLink>

        {run.failure && (
          <span className={FIGURE} title={run.failure}>
            {run.failure}
          </span>
        )}
      </span>

      <span className={FIGURE}>Round {run.round}</span>
      <span className={FIGURE}>{checksShown(run.checks)}</span>
      <span className={FIGURE}>{nextShown(run.next)}</span>
      <span className={FIGURE}>{deliveryShown(run.delivery)}</span>
      <span className={NUMBER}>{runTook(run.cost)}</span>
      <span className={NUMBER}>{runSpent(run.cost)}</span>
      <span className={NUMBER}>{since(run.endedAt)}</span>
    </li>
  );
}
