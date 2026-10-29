import type { ReactNode } from 'react';
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
    <li data-slot="cost-slice" className="flex items-center gap-2 text-xs">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-sm"
        style={{ background: fill }}
      />
      <span className="min-w-0 flex-1 truncate text-foreground">
        {children}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {formatCount(slice.runs)} {slice.runs === 1 ? 'run' : 'runs'}
      </span>
      <WithTooltip tooltip={`${formatShare(slice.share)} of the spend`}>
        <span className="w-16 text-right text-foreground tabular-nums">
          {spentIn(slice.amount, currency)}
        </span>
      </WithTooltip>
    </li>
  );
}
