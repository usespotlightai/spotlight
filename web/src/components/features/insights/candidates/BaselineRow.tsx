import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  INNER_DIVIDER,
  INNER_GUIDE,
  INNER_INDENT,
  OUTER_GUIDE,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { formatCount } from '@/lib/insights';
import type { CandidatesSet } from '@/lib/insights-candidates';
import { formatPercent } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import { formatCostPerRun } from '@/lib/search';
import { cn } from '@/lib/utils';

type BaselineRowProps = {
  at: ReplayedStation;
  baseline: NonNullable<CandidatesSet['baseline']>;
  heldOut: boolean;
};

export function BaselineRow({ at, baseline, heldOut }: BaselineRowProps) {
  return (
    <li
      data-slot="replayed-baseline"
      className={cn(
        'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-1 pr-2 @4xl:h-8 @4xl:grid-cols-subgrid',
        OUTER_GUIDE,
        INNER_GUIDE,
        INNER_DIVIDER,
      )}
    >
      <div
        className={cn(
          'col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1',
          INNER_INDENT,
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
      <TrailLink
        to={replayPath(at, baseline.replayId)}
        className={pillClass(
          'outline',
          'justify-self-start whitespace-nowrap @4xl:justify-self-end',
        )}
      >
        Changes
      </TrailLink>
    </li>
  );
}
