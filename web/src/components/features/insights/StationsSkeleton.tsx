import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { BY_STATION_NOTE } from '@/lib/insights';
import { TALLY_TILES } from '@/lib/insights-tiles';
import { stationTableHeadings, TYPICAL_COUNTED } from '@/lib/station-insights';

export function StationsSkeleton({ stations }: { stations: number }) {
  return (
    <div
      role="status"
      aria-label="Loading the stations"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton
        label="The whole team"
        tiles={TALLY_TILES}
        topAligned
      />

      <InsightsCardSkeleton title="By station" description={BY_STATION_NOTE}>
        <NestedTableSkeleton
          label="Loading each station’s runs"
          headings={stationTableHeadings(TYPICAL_COUNTED)}
          rows={stations}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
