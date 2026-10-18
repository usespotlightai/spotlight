import { BarRowSkeleton } from '@/components/features/insights/BarRowSkeleton';
import { COST_SANKEY_HEIGHT } from '@/components/features/insights/CostSankey';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import {
  CACHE_HEADINGS,
  CACHE_NOTE,
  COST_DIMENSIONS,
  COST_SANKEY_NOTE,
} from '@/lib/insights';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'Spend', wide: true, delta: true },
  { label: 'Runs with no price', detail: 'Harness reports no cost' },
  { label: 'Cache share', detail: 'Share of input tokens read from cache' },
];

const SLICES = 4;

export function CostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the cost"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton label="Spend" tiles={TILES} />

      <div className="grid gap-3 md:grid-cols-2">
        {COST_DIMENSIONS.map((dimension) => (
          <InsightsCardSkeleton key={dimension.id} title={dimension.label}>
            <ul className="flex flex-col gap-1.5 pb-2">
              {Array.from({ length: SLICES }, (_, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder slices have no identity
                <BarRowSkeleton key={at} />
              ))}
            </ul>
          </InsightsCardSkeleton>
        ))}
      </div>

      <InsightsCardSkeleton
        switchable
        title="Where the spend goes"
        description={COST_SANKEY_NOTE}
      >
        <ChartSkeleton height={COST_SANKEY_HEIGHT} />
      </InsightsCardSkeleton>

      <InsightsCardSkeleton
        tableOnly
        title="Read from cache"
        description={CACHE_NOTE}
      >
        <NestedTableSkeleton
          label="Loading the cache share"
          headings={CACHE_HEADINGS}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
