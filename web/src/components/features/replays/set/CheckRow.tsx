import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  appPathOf,
  type ReplayCheckSummary,
  referenceShown,
} from '@/lib/search';
import { verdictShown } from '@/lib/search-words';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

const INK: Record<ReplayCheckSummary['verdict'], string> = {
  running: 'text-foreground',
  passed: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-destructive',
  undecided: 'text-muted-foreground',
};

type CheckRowProps = {
  check: ReplayCheckSummary;
};

export function CheckRow({ check }: CheckRowProps) {
  const reference = referenceShown(check.reference) ?? 'A planned change';

  return (
    <li data-slot="replay-check" className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        {check.replayUrl ? (
          <TrailLink
            to={appPathOf(check.replayUrl)}
            className="truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {reference}
          </TrailLink>
        ) : (
          <span className="truncate font-medium text-foreground">
            {reference}
          </span>
        )}
        {check.attempt > 1 && (
          <span className="shrink-0 text-muted-foreground">
            attempt {check.attempt}
          </span>
        )}
      </span>
      <NestedCell heading="Verdict" numeric={false}>
        <span
          title={verdictShown(check.verdict, check.undecidedBecause)}
          className={cn('block truncate', INK[check.verdict])}
        >
          {verdictShown(check.verdict, check.undecidedBecause)}
        </span>
      </NestedCell>
      <NestedCell heading="Regressions">{check.regressions}</NestedCell>
      <NestedCell heading="When">{since(check.createdAt)}</NestedCell>
    </li>
  );
}
