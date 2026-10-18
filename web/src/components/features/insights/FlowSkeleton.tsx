import { WAIT_SERIES } from '@/components/features/insights/chart-series';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTileSkeleton } from '@/components/features/insights/InsightsTileSkeleton';
import { WAIT_ROW_HEIGHT } from '@/components/features/insights/StationWaits';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { TileGroup } from '@/components/features/insights/TileGroup';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import { DELIVERY_NOTE, WAITS_NOTE } from '@/lib/insights';

const DELIVERY = ['PRs opened', 'First reviews', 'PRs merged'];

const LEGEND = WAIT_SERIES.map(({ label, fill }) => ({ label, color: fill }));

export function FlowSkeleton({ stations }: { stations: number }) {
  return (
    <div
      role="status"
      aria-label="Loading the flow"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton
        switchable
        title="Where tasks wait"
        description={WAITS_NOTE}
      >
        <figure className="flex flex-col gap-1">
          <ChartLegend entries={LEGEND} />
          <ChartSkeleton height={stations * WAIT_ROW_HEIGHT + 16} />
        </figure>
      </InsightsCardSkeleton>

      <TileGroup title="Past the last station" tooltip={DELIVERY_NOTE}>
        {DELIVERY.map((label) => (
          <InsightsTileSkeleton key={label} label={label} delta detail />
        ))}
      </TileGroup>
    </div>
  );
}
