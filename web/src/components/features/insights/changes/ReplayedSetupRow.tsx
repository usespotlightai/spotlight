import { BestValueMark } from '@/components/features/insights/BestValueMark';
import { Noted } from '@/components/shared/Noted';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { spentIn } from '@/lib/inbox';
import { formatCount, formatShare } from '@/lib/insights';
import { formatSource, type ReplayedPoint } from '@/lib/insights-candidates';
import { cn } from '@/lib/utils';

type ReplayedSetupRowProps = {
  point: ReplayedPoint;
  currency: string;
};

export function ReplayedSetupRow({ point, currency }: ReplayedSetupRowProps) {
  return (
    <li
      data-slot="replayed-setup-row"
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
        {point.mark === 'baseline' ? (
          <Noted note={point.label}>
            <span className="min-w-0 truncate font-medium text-foreground text-xs">
              Live config
            </span>
          </Noted>
        ) : (
          <span className="min-w-0 truncate font-medium text-foreground text-xs">
            {point.label}
          </span>
        )}
        {point.frontier && <BestValueMark />}
      </div>
      <NestedCell heading="Source" numeric={false}>
        {formatSource(point.mark)}
      </NestedCell>
      <NestedCell heading="Runs scored">{formatCount(point.scored)}</NestedCell>
      <NestedCell heading="Cost per run" strong>
        {spentIn(point.cost, currency)}
      </NestedCell>
      <NestedCell heading="Replay success" strong>
        {formatShare(point.value)}
      </NestedCell>
      <NestedCell heading="Held out">{point.heldOut ?? '–'}</NestedCell>
    </li>
  );
}
