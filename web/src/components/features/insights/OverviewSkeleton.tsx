import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { OUTPUT_CHART_HEIGHT } from '@/components/features/insights/OutputAgainstCost';
import { OutputLegend } from '@/components/features/insights/OutputLegend';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import {
  OUTPUT_NOTE,
  STATIONS_WORTH_IMPROVING_HEADINGS,
  STATIONS_WORTH_IMPROVING_NOTE,
} from '@/lib/insights';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'Spend', wide: true, delta: true, detail: true, trend: true },
  { label: 'PRs merged', delta: true, detail: true, trend: true },
  { label: 'Merge rate', delta: true },
  { label: 'Cost per merged PR', wide: true, delta: true },
  { label: 'Task to merge', delta: true, detail: true },
  { label: 'Actions per task', delta: true, detail: true },
  { label: 'Active people', delta: true },
];

export function OverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the overview"
      className={OVERVIEW_LAYOUT}
    >
      <InsightsTilesSkeleton label="Headline numbers" tiles={TILES} />

      <InsightsCardSkeleton
        switchable
        flat
        title="Output against cost"
        description={OUTPUT_NOTE}
      >
        <figure className="flex flex-col gap-1">
          <OutputLegend priced />
          <ChartSkeleton height={OUTPUT_CHART_HEIGHT} />
          <div className="h-5" />
        </figure>
      </InsightsCardSkeleton>

      <InsightsCardSkeleton
        flat
        title="Stations worth improving"
        description={STATIONS_WORTH_IMPROVING_NOTE}
      >
        <NestedTableSkeleton
          label="Loading the stations worth improving"
          headings={STATIONS_WORTH_IMPROVING_HEADINGS}
          rows={3}
          trailing
          rowClassName="py-2.5"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
