import { ChevronSpace } from '@/components/shared/nested-table/ExpandToggle';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { formatCount } from '@/lib/insights';
import {
  type CandidatesSet,
  formatCostPerRun,
} from '@/lib/insights-candidates';
import { formatPercent } from '@/lib/judge';
import { cn } from '@/lib/utils';

type BaselineRowProps = {
  baseline: NonNullable<CandidatesSet['baseline']>;
  heldOut: boolean;
};

export function BaselineRow({ baseline, heldOut }: BaselineRowProps) {
  return (
    <li
      data-slot="replayed-baseline"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-sm @4xl:h-9 @lg:group-data-compact/nested:h-9 @4xl:grid-cols-subgrid @lg:group-data-compact/nested:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <div
        className={cn(
          'col-span-full flex min-w-0 items-start gap-1 @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1',
          OUTER_INDENT,
        )}
      >
        <ChevronSpace />
        <span className="min-w-0 truncate text-foreground leading-4">
          Live config
        </span>
      </div>
      <span className="hidden @4xl:block @lg:group-data-compact/nested:block" />
      <NestedCell heading="Source" numeric={false}>
        Live
      </NestedCell>
      <NestedCell heading="Candidate">–</NestedCell>
      <NestedCell heading="Live" strong>
        {formatPercent(baseline.successRate)}
      </NestedCell>
      <span className="hidden @4xl:block @lg:group-data-compact/nested:block" />
      <NestedCell heading="Cost per run">–</NestedCell>
      <NestedCell heading="Live cost" strong>
        {formatCostPerRun(baseline.costPerRun, baseline.currency)}
      </NestedCell>
      {heldOut && (
        <span className="hidden @4xl:block @lg:group-data-compact/nested:block" />
      )}
      <NestedCell heading="Runs">{formatCount(baseline.scored)}</NestedCell>
      <span className="hidden @4xl:block @lg:group-data-compact/nested:block" />
    </li>
  );
}
