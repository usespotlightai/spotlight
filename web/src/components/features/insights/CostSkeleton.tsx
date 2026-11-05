import { COST_SANKEY_HEIGHT } from '@/components/features/insights/CostSankey';
import { CostSlicesSkeleton } from '@/components/features/insights/CostSlicesSkeleton';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import {
  OVERVIEW_LAYOUT,
  PAIR_GRID,
} from '@/components/features/insights/overview-layout';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import { CACHE_HEADINGS, CACHE_NOTE, COST_SANKEY_NOTE } from '@/lib/insights';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'Spend', wide: true, delta: true },
  { label: 'Cache share', detail: 'Of tokens read' },
];

export function CostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the cost"
      className={OVERVIEW_LAYOUT}
    >
      <InsightsTilesSkeleton label="Spend" tiles={TILES} />

      <InsightsCardSkeleton
        switchable
        flat
        title="Where the spend goes"
        description={COST_SANKEY_NOTE}
      >
        <ChartSkeleton height={COST_SANKEY_HEIGHT} />
      </InsightsCardSkeleton>

      <div className={PAIR_GRID}>
        <CostSlicesSkeleton />
        <InsightsCardSkeleton
          tableOnly
          flat
          title="Cache share by station"
          description={CACHE_NOTE}
        >
          <NestedTableSkeleton
            label="Loading the cache share"
            headings={CACHE_HEADINGS}
            compact
            rowClassName="py-2"
          />
        </InsightsCardSkeleton>
      </div>
    </div>
  );
}
