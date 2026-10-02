import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { since } from '@/lib/runner';
import {
  appPathOf,
  type ReplayCheckSummary,
  referenceShown,
  regressionsShown,
} from '@/lib/search';
import { verdictShown } from '@/lib/search-words';
import { cn } from '@/lib/utils';

const INK: Record<ReplayCheckSummary['verdict'], string> = {
  running: 'text-foreground',
  passed: 'text-primary',
  failed: 'text-destructive',
  undecided: 'text-muted-foreground',
};

type CheckRowProps = {
  check: ReplayCheckSummary;
};

export function CheckRow({ check }: CheckRowProps) {
  const reference = referenceShown(check.reference);

  return (
    <li
      data-slot="replay-check"
      className="flex flex-col gap-1 rounded-md px-2 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate font-medium text-foreground">
          {reference ?? 'A planned change'}
        </span>
        <Pill className={cn(INK[check.verdict])}>
          {verdictShown(check.verdict, check.undecidedBecause)}
        </Pill>
        <span className="text-muted-foreground text-xs sm:ml-auto">
          {since(check.createdAt)}
        </span>
      </div>
      <p className="flex flex-wrap gap-x-1.5 text-muted-foreground text-xs tabular-nums">
        <span>{regressionsShown(check.regressions)}</span>
        {check.attempt > 1 && <span>· attempt {check.attempt}</span>}
        {check.replayUrl && (
          <span>
            ·{' '}
            <TrailLink
              to={appPathOf(check.replayUrl)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              Its replay
            </TrailLink>
          </span>
        )}
      </p>
    </li>
  );
}
