import { useState } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { Segmented } from '@/components/shared/Segmented';
import { spentIn } from '@/lib/inbox';
import {
  COST_DIMENSIONS,
  type CostDimension,
  type CostSlice,
  formatCount,
  formatShare,
  type SliceNamer,
  sliceFilter,
} from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import { cn } from '@/lib/utils';

export const SLICE_TITLE = 'Spend by';

export const sliceHeadings = (heading: string): readonly NestedHeading[] => [
  { label: heading, indent: 'edge', size: 'minmax(8rem,3fr)' },
  { label: 'Share', numeric: true, size: 'minmax(7rem,1fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Spend', numeric: true, size: SPREAD },
];

type CostSlicesProps = {
  slicesOf: (dimension: CostDimension) => readonly CostSlice[];
  currency: string;
  named: SliceNamer;
};

export function CostSlices({ slicesOf, currency, named }: CostSlicesProps) {
  const [dimension, setDimension] = useState<CostDimension>('harness');
  const slices = slicesOf(dimension);
  const heading =
    COST_DIMENSIONS.find((each) => each.id === dimension)?.label ?? '';

  return (
    <InsightsCard
      flat
      title={SLICE_TITLE}
      actions={
        <Segmented
          label="Split the spend by"
          segments={COST_DIMENSIONS}
          value={dimension}
          onChange={setDimension}
        />
      }
    >
      {slices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing priced.</p>
      ) : (
        <NestedTable
          label={`Spend by ${heading.toLowerCase()}`}
          headings={sliceHeadings(heading)}
          compact
        >
          {slices.map((slice) => {
            const label = named(dimension, slice.key);
            const filter = sliceFilter(dimension, slice.key);

            return (
              <li
                key={slice.key ?? 'none'}
                data-slot="cost-slice"
                className={cn(TABLE_ROW, ROW_DIVIDER)}
              >
                <span className={cn(LEAD_CELL, EDGE_INDENT)}>
                  <span className="truncate text-foreground">
                    {filter ? (
                      <InsightsLink tab="traces" filter={filter}>
                        {label}
                      </InsightsLink>
                    ) : (
                      label
                    )}
                  </span>
                </span>
                <NestedCell heading="Share">
                  <span className="inline-flex items-center justify-end gap-2.5">
                    <span className="w-9 text-right">
                      {formatShare(slice.share)}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 w-12 overflow-hidden rounded-full bg-chart-primary/12"
                    >
                      <span
                        className="block h-full rounded-full bg-chart-primary"
                        style={{ width: `${(slice.share ?? 0) * 100}%` }}
                      />
                    </span>
                  </span>
                </NestedCell>
                <NestedCell heading="Runs">
                  {formatCount(slice.runs)}
                </NestedCell>
                <NestedCell heading="Spend" strong>
                  {spentIn(slice.amount, currency)}
                </NestedCell>
              </li>
            );
          })}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
