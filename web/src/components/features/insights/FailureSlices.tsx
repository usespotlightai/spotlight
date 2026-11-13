import type { ReactNode } from 'react';

import { sliceFill } from '@/components/features/insights/chart-series';
import { SliceDonut } from '@/components/features/insights/SliceDonut';
import { SliceRow } from '@/components/features/insights/SliceRow';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatShare } from '@/lib/insights';

type FailureSlice = {
  key: string;
  count: number;
  title: string;
  label: ReactNode;
};

type FailureSlicesProps = {
  label: string;
  of: string;
  slices: readonly FailureSlice[];
};

export function FailureSlices({ label, of, slices }: FailureSlicesProps) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <div className="flex min-w-0 flex-col items-start gap-3 pb-3 @sm/pane:flex-row @sm/pane:items-center @sm/pane:gap-4">
      {total > 0 && (
        <SliceDonut
          slot="failure-donut"
          slices={slices.map((slice) => ({
            key: slice.key,
            value: slice.count,
          }))}
        />
      )}
      <ul
        aria-label={label}
        className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch @sm/pane:self-auto"
      >
        {slices.map((slice, at) => (
          <SliceRow
            key={slice.key}
            slot="failure-slice"
            fill={sliceFill(at)}
            title={slice.title}
            values={
              <WithTooltip
                tooltip={`${formatShare(total > 0 ? slice.count / total : 0)} of ${of}`}
              >
                <span className="w-10 text-right text-foreground tabular-nums">
                  {slice.count}
                </span>
              </WithTooltip>
            }
          >
            {slice.label}
          </SliceRow>
        ))}
      </ul>
    </div>
  );
}
