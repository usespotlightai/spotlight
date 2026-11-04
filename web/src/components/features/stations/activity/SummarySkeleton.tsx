import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { SEVEN_TILES } from '@/components/features/insights/overview-layout';
import { TabSection } from '@/components/features/stations/TabSection';
import { TALLY_TILES } from '@/lib/insights-tiles';
import { type ActivityPeriod, LIVE_CONFIG } from '@/lib/station';
import { SUMMARY_COLUMNS, summaryTitleOf } from '@/lib/station-insights';

const LIVE_TILES = SUMMARY_COLUMNS.map((column) => ({
  label: column.label,
  detail: Boolean(column.counted),
  trend: column.visual !== 'none',
}));

type SummarySkeletonProps = {
  period: ActivityPeriod;
};

export function SummarySkeleton({ period }: SummarySkeletonProps) {
  const title = summaryTitleOf(period);

  return (
    <TabSection title={title}>
      <InsightsTilesSkeleton
        label={title}
        className={SEVEN_TILES}
        tiles={period === LIVE_CONFIG ? LIVE_TILES : TALLY_TILES}
      />
    </TabSection>
  );
}
