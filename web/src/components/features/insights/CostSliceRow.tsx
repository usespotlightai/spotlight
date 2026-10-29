import type { ReactNode } from 'react';
import { SliceRow } from '@/components/features/insights/SliceRow';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { spentIn } from '@/lib/inbox';
import { type CostSlice, formatCount, formatShare } from '@/lib/insights';

type CostSliceRowProps = {
  slice: CostSlice;
  fill: string;
  currency: string;
  children: ReactNode;
};

export function CostSliceRow({
  slice,
  fill,
  currency,
  children,
}: CostSliceRowProps) {
  return (
    <SliceRow
      slot="cost-slice"
      fill={fill}
      values={
        <>
          <span className="text-muted-foreground tabular-nums">
            {formatCount(slice.runs)} {slice.runs === 1 ? 'run' : 'runs'}
          </span>
          <WithTooltip tooltip={`${formatShare(slice.share)} of the spend`}>
            <span className="w-16 text-right text-foreground tabular-nums">
              {spentIn(slice.amount, currency)}
            </span>
          </WithTooltip>
        </>
      }
    >
      {children}
    </SliceRow>
  );
}
