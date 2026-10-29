import { CostSliceRow } from '@/components/features/insights/CostSliceRow';
import { sliceFill } from '@/components/features/insights/chart-series';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SliceDonut } from '@/components/features/insights/SliceDonut';
import {
  type CostDimension,
  type CostSlice,
  type SliceNamer,
  sliceFilter,
} from '@/lib/insights';

type CostSlicesProps = {
  title: string;
  dimension: CostDimension;
  slices: readonly CostSlice[];
  currency: string;
  named: SliceNamer;
};

export function CostSlices({
  title,
  dimension,
  slices,
  currency,
  named,
}: CostSlicesProps) {
  return (
    <InsightsCard title={title}>
      {slices.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">Nothing priced.</p>
      ) : (
        <div className="flex items-center gap-4 pb-3">
          {slices.some((slice) => slice.amount > 0) && (
            <SliceDonut
              slot="cost-donut"
              slices={slices.map((slice) => ({
                key: slice.key ?? 'none',
                value: slice.amount,
              }))}
            />
          )}
          <ul
            aria-label={`Spend ${title.toLowerCase()}`}
            className="flex min-w-0 flex-1 flex-col gap-1.5"
          >
            {slices.map((slice, at) => {
              const label = named(dimension, slice.key);
              const filter = sliceFilter(dimension, slice.key);

              return (
                <CostSliceRow
                  key={slice.key ?? 'none'}
                  slice={slice}
                  fill={sliceFill(at)}
                  currency={currency}
                >
                  {filter ? (
                    <InsightsLink tab="traces" filter={filter}>
                      {label}
                    </InsightsLink>
                  ) : (
                    label
                  )}
                </CostSliceRow>
              );
            })}
          </ul>
        </div>
      )}
    </InsightsCard>
  );
}
