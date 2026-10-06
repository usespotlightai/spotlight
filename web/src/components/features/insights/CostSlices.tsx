import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { spentIn } from '@/lib/inbox';
import {
  type CostDimension,
  type CostSlice,
  countShown,
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
  const most = Math.max(...slices.map((slice) => slice.amount), 0);

  return (
    <InsightsCard title={title}>
      {slices.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">Nothing priced.</p>
      ) : (
        <ul
          aria-label={`Spend ${title.toLowerCase()}`}
          className="flex flex-col gap-1.5"
        >
          {slices.map((slice) => {
            const label = named(dimension, slice.key);
            const filter = sliceFilter(dimension, slice.key);

            return (
              <li
                key={slice.key ?? 'none'}
                data-slot="cost-slice"
                className="flex flex-col gap-0.5 text-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {filter ? (
                      <InsightsLink tab="runs" filter={filter}>
                        {label}
                      </InsightsLink>
                    ) : (
                      label
                    )}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {countShown(slice.runs)} {slice.runs === 1 ? 'run' : 'runs'}
                  </span>
                  <span className="w-16 text-right text-foreground tabular-nums">
                    {spentIn(slice.amount, currency)}
                  </span>
                </div>
                <span aria-hidden className="h-1 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-chart-primary"
                    style={{
                      width: `${most > 0 ? (slice.amount / most) * 100 : 0}%`,
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </InsightsCard>
  );
}
