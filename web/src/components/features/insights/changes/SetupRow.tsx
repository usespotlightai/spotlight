import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { spentIn } from '@/lib/inbox';
import { countShown } from '@/lib/insights';
import {
  type OutcomeMeasure,
  outcomeShown,
  type SetupOutcome,
  setupWithinShown,
  shownMeasures,
} from '@/lib/insights-changes';
import { cn } from '@/lib/utils';

type SetupRowProps = {
  setup: SetupOutcome;
  measure: OutcomeMeasure;
  judged: boolean;
};

export function SetupRow({ setup, measure, judged }: SetupRowProps) {
  return (
    <li
      data-slot="setup-row"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <div
        className={cn(
          'col-span-full flex min-w-0 items-center gap-2 @4xl:col-span-1',
          OUTER_INDENT,
        )}
      >
        <span className="min-w-0 truncate font-medium text-foreground text-xs">
          {setupWithinShown(setup)}
        </span>
        {setup.frontier.includes(measure) && <BestValueMark />}
      </div>
      <NestedCell heading="Runs">{countShown(setup.tally.runs)}</NestedCell>
      <NestedCell heading="Cost per run" strong>
        {setup.costPerRun === null || !setup.currency
          ? '–'
          : spentIn(setup.costPerRun, setup.currency)}
      </NestedCell>
      {shownMeasures(judged).map((each) => (
        <NestedCell
          key={each.id}
          heading={each.label}
          strong={each.id === measure}
        >
          {outcomeShown(setup.outcomes[each.id])}
        </NestedCell>
      ))}
    </li>
  );
}
