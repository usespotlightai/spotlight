import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
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
      <NestedCell heading="Cost">{runSpent(run.cost)}</NestedCell>
      <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
    </li>
  );
}
