import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { RECENT_RUN_HEADINGS } from '@/lib/station-outcomes';

export function RecentRunsSkeleton() {
  return (
    <InsightsCardSkeleton
      label="Loading the station’s runs"
      tableOnly
      level={3}
      title="Recent runs"
      actions={<SectionLinkSkeleton>All runs</SectionLinkSkeleton>}
    >
      <NestedTableSkeleton
        label="Loading the station’s runs"
        headings={RECENT_RUN_HEADINGS}
        rows={5}
      />
    </InsightsCardSkeleton>
  );
}
