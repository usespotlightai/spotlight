import { TabSection } from '@/components/features/stations/TabSection';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { SectionLinkSkeleton } from '@/components/shared/skeleton/SectionLinkSkeleton';
import { RECENT_RUN_HEADINGS, RECENT_RUNS_TITLE } from '@/lib/station-insights';

export function RecentRunsSkeleton() {
  return (
    <TabSection
      title={RECENT_RUNS_TITLE}
      action={<SectionLinkSkeleton>All runs</SectionLinkSkeleton>}
    >
      <div className="-mx-2">
        <NestedTableSkeleton
          label="Loading the station’s runs"
          headings={RECENT_RUN_HEADINGS}
          rows={5}
        />
      </div>
    </TabSection>
  );
}
