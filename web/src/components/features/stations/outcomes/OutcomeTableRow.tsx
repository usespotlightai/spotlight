import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { since } from '@/lib/since';
import {
  endedBadly,
  formatChecks,
  formatEnding,
  formatHumanAction,
  formatPullRequestState,
  formatRunDuration,
  runSpent,
  type StationRunOutcome,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type OutcomeTableRowProps = {
  run: StationRunOutcome;
  to: string;
};

export function OutcomeTableRow({ run, to }: OutcomeTableRowProps) {
  return (
    <li
      data-slot="outcome-row"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 transition-colors hover:bg-muted/20 @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <span
        className={cn(
          'col-span-full flex min-w-0 items-center gap-2 text-xs @4xl:col-span-1',
          OUTER_INDENT,
        )}
      >
        <TrailLink
          to={to}
          className={cn(
            'shrink-0 font-medium outline-none after:absolute after:inset-0',
            endedBadly(run.ending) ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatEnding(run.ending)}
        </TrailLink>
        {run.failure && (
          <span className="truncate text-muted-foreground" title={run.failure}>
            {run.failure}
          </span>
        )}
      </span>
      <NestedCell heading="Visit" numeric={false}>
        {run.visit}
      </NestedCell>
      <NestedCell heading="Checks" numeric={false}>
        {formatChecks(run.checks)}
      </NestedCell>
      <NestedCell heading="Human action" numeric={false}>
        {formatHumanAction(run.firstHumanAction)}
      </NestedCell>
      <NestedCell heading="Pull request" numeric={false}>
        {formatPullRequestState(run.pullRequestState)}
      </NestedCell>
      <NestedCell heading="Duration">{formatRunDuration(run.usage)}</NestedCell>
      <NestedCell heading="Cost">{runSpent(run.usage)}</NestedCell>
      <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
    </li>
  );
}
