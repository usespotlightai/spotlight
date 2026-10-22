import { BarRow } from '@/components/features/insights/BarRow';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { spentIn } from '@/lib/inbox';
import {
  type CostDimension,
  type CostSlice,
  formatCount,
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
  const max = Math.max(...slices.map((slice) => slice.amount), 0);

  return (
    <InsightsCard title={title}>
      {slices.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">Nothing priced.</p>
      ) : (
        <ul
          aria-label={`Spend ${title.toLowerCase()}`}
          className="flex flex-col gap-1.5 pb-2"
        >
          {slices.map((slice) => {
            const label = named(dimension, slice.key);
            const filter = sliceFilter(dimension, slice.key);

            return (
              <BarRow
                key={slice.key ?? 'none'}
                slot="cost-slice"
                share={max > 0 ? slice.amount / max : 0}
                values={
                  <>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCount(slice.runs)}{' '}
                      {slice.runs === 1 ? 'run' : 'runs'}
                    </span>
                    <span className="w-16 text-right text-foreground tabular-nums">
                      {spentIn(slice.amount, currency)}
                    </span>
                  </>
                }
              >
                {filter ? (
                  <InsightsLink tab="traces" filter={filter}>
                    {label}
                  </InsightsLink>
                ) : (
                  label
                )}
              </BarRow>
            );
          })}
        </ul>
      )}
    </InsightsCard>
  );
}
