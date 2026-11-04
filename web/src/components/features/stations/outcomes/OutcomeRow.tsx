import { OutcomeIcon } from '@/components/features/stations/activity/OutcomeIcon';
import { toneLabel } from '@/components/features/stations/activity/outcome-tones';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
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
          {toneLabel(run)}
        </TrailLink>

        {run.failure && (
          <span className="relative flex">
            <InfoTooltip tooltip={run.failure} />
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
      <NestedCell heading="Cost" strong>
        {runSpent(run.usage)}
      </NestedCell>
      <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
    </li>
  );
}
