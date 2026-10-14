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

type OutcomeRowProps = {
  run: StationRunOutcome;
  to: string;
};

export function OutcomeRow({ run, to }: OutcomeRowProps) {
  return (
    <li className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <TrailLink
          to={to}
          className={cn(
            'shrink-0 font-medium outline-none after:absolute after:inset-0',
            endedBadly(run.ending) ? 'text-destructive' : 'text-foreground',
          )}
        >
          {endingShown(run.ending)}
        </TrailLink>

        {run.failure && (
          <span className="truncate text-muted-foreground" title={run.failure}>
            {run.failure}
          </span>
        )}
      </span>

      <NestedCell heading="Round" numeric={false}>
        {run.round}
      </NestedCell>
      <NestedCell heading="Checks" numeric={false}>
        {checksShown(run.checks)}
      </NestedCell>
      <NestedCell heading="Next" numeric={false}>
        {nextShown(run.next)}
      </NestedCell>
      <NestedCell heading="Delivery" numeric={false}>
        {deliveryShown(run.delivery)}
      </NestedCell>
      <NestedCell heading="Took">{runTook(run.cost)}</NestedCell>
      <NestedCell heading="Cost" strong>
        {runSpent(run.cost)}
      </NestedCell>
      <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
    </li>
  );
}
