import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
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
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-1 pr-2 @4xl:h-8 @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        OUTER_DIVIDER,
      )}
    >
      <div
        className={cn(
          'col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1',
          OUTER_INDENT,
        )}
      >
        <span className="font-medium text-foreground text-xs">Live config</span>
      </div>
      <span className="hidden @4xl:block" />
      <NestedCell heading="Source" numeric={false}>
        Live
      </NestedCell>
      <div className="col-span-full min-w-0 @4xl:col-span-1">
        <RateTrack rate={null} live={baseline.successRate} />
      </div>
      <NestedCell heading="Candidate">–</NestedCell>
      <NestedCell heading="Live" strong>
        {formatPercent(baseline.successRate)}
      </NestedCell>
      <span className="hidden @4xl:block" />
      <NestedCell heading="Cost per run">–</NestedCell>
      <NestedCell heading="Live cost" strong>
        {formatCostPerRun(baseline.costPerRun, baseline.currency)}
      </NestedCell>
      {heldOut && <span className="hidden @4xl:block" />}
      <NestedCell heading="Runs">{formatCount(baseline.scored)}</NestedCell>
      <span className="hidden @4xl:block" />
    </li>
  );
}
