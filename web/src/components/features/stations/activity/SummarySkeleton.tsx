import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { TabSection } from '@/components/features/stations/TabSection';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { SUMMARY_COLUMNS, SUMMARY_TITLE } from '@/lib/station-insights';

const TILES = SUMMARY_COLUMNS.map((column) => ({
  label: column.label,
  detail: Boolean(column.counted),
  trend: column.visual !== 'none',
}));

export function SummarySkeleton() {
  return (
    <TabSection
      title={SUMMARY_TITLE}
      action={<SectionLinkSkeleton>See in Insights</SectionLinkSkeleton>}
    >
      <InsightsTilesSkeleton label={SUMMARY_TITLE} tiles={TILES} />
    </TabSection>
  );
}
