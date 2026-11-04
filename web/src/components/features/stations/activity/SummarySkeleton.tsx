import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { TabSection } from '@/components/features/stations/TabSection';
import type { TileBones } from '@/lib/insights-tiles';
import { type ActivityPeriod, LIVE_CONFIG } from '@/lib/station';
import { OUTCOMES_TITLE, summaryTitleOf } from '@/lib/station-insights';

const tilesOf = (period: ActivityPeriod): readonly TileBones[] => {
  const changed = period !== LIVE_CONFIG;

  return [
    { label: 'Runs', delta: changed, trend: true },
    { label: OUTCOMES_TITLE, trend: true },
    { label: 'Cost', delta: changed, trend: !changed },
    { label: 'Median run', delta: changed, trend: !changed },
  ];
};

type SummarySkeletonProps = {
  period: ActivityPeriod;
};

export function SummarySkeleton({ period }: SummarySkeletonProps) {
  const title = summaryTitleOf(period);

  return (
    <TabSection title={title}>
      <InsightsTilesSkeleton label={title} tiles={tilesOf(period)} />
    </TabSection>
  );
}
