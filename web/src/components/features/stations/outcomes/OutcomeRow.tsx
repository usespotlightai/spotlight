import { OutcomeIcon } from '@/components/features/stations/activity/OutcomeIcon';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { since } from '@/lib/since';
import {
  formatChecks,
  formatHumanAction,
  formatPullRequestState,
  formatRunDuration,
  outcomeTone,
  runSpent,
  type StationRunOutcome,
  resolutionLabel,
} from '@/lib/station-insights';
import { cn } from '@/lib/utils';

type OutcomeRowProps = {
  run: StationRunOutcome;
  to: string;
};

export function OutcomeRow({ run, to }: OutcomeRowProps) {
  return (
    <li className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <OutcomeIcon tone={outcomeTone(run)} />
        <TrailLink
          to={to}
          className="shrink-0 text-foreground outline-none after:absolute after:inset-0"
        >
          {resolutionLabel(run)}
        </TrailLink>

        {run.failure && (
          <span className="relative hidden @4xl:flex @lg:group-data-compact/nested:flex">
            <InfoTooltip tooltip={run.failure} />
          </span>
        )}
      </span>

      {run.failure && (
        <p className="col-span-full pl-(--cell-indent,0.5rem) text-muted-foreground text-xs @4xl:hidden @lg:group-data-compact/nested:hidden">
          {run.failure}
        </p>
      )}

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
      <NestedCell heading="Cost" strong>
        {runSpent(run.usage)}
      </NestedCell>
      <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
    </li>
  );
}
